import os
import json
import asyncio
from celery import Celery, Task
from celery.result import AsyncResult
from pathlib import Path
import aiohttp
import aiofiles
from datetime import datetime
from typing import Dict, Any

# Получаем URL для Redis из переменных окружения
CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', 'redis://localhost:6379/0')

# Настройка Celery
celery_app = Celery(
    'thread_downloader',
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND
)

# Конфигурация Celery
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    result_expires=3600,  # Результаты хранятся 1 час
    task_track_started=True,
    task_send_sent_event=True,
)

# Константы из thread_downloader.py
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}
VIDEO_EXTENSIONS = {'.mp4', '.webm', '.mov', '.avi', '.mkv'}

headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
}


class CallbackTask(Task):
    """Задача с поддержкой обновления прогресса"""
    def on_success(self, retval, task_id, args, kwargs):
        """Успешное завершение"""
        pass
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Обработка ошибок"""
        pass


async def fetch_and_save_json(session, thread_id, save_dir):
    """Загрузка и сохранение JSON треда"""
    url = f'https://2ch.hk/b/res/{thread_id}.json'
    async with session.get(url, headers=headers) as resp:
        resp.raise_for_status()
        data_text = await resp.text()

    json_path = save_dir / f"{thread_id}.json"
    async with aiofiles.open(json_path, 'w', encoding='utf-8') as f:
        await f.write(data_text)
    
    return json.loads(data_text)


async def handle_download(session, url, dest_path, is_original, sem, stats, failures):
    """Загрузка отдельного файла"""
    async with sem:
        try:
            async with session.get(url, headers=headers) as resp:
                resp.raise_for_status()
                os.makedirs(os.path.dirname(dest_path), exist_ok=True)
                async with aiofiles.open(dest_path, 'wb') as f:
                    async for chunk in resp.content.iter_chunked(1024):
                        await f.write(chunk)
            
            if is_original:
                ext = Path(dest_path).suffix.lower()
                if ext in IMAGE_EXTENSIONS:
                    stats['photos'] += 1
                elif ext in VIDEO_EXTENSIONS:
                    stats['videos'] += 1
                else:
                    stats['other'] += 1
        except Exception as e:
            failures.append((url, dest_path, is_original))


async def download_thread_async(thread_id: str, task) -> Dict[str, Any]:
    """Асинхронная функция загрузки треда"""
    base_dir = Path(f'downloads/{thread_id}')
    thumb_dir = base_dir / 'thumb'
    base_dir.mkdir(parents=True, exist_ok=True)
    thumb_dir.mkdir(parents=True, exist_ok=True)

    result = {
        'thread_id': thread_id,
        'status': 'processing',
        'started_at': datetime.utcnow().isoformat(),
        'stats': {'photos': 0, 'videos': 0, 'other': 0, 'total': 0},
        'errors': []
    }

    try:
        async with aiohttp.ClientSession() as session:
            # Обновляем статус: загрузка JSON
            task.update_state(
                state='PROGRESS',
                meta={'status': 'downloading_json', 'progress': 5}
            )
            
            data = await fetch_and_save_json(session, thread_id, base_dir)
            threads = data.get('threads', [])
            posts = threads[0].get('posts', []) if threads else []

            # Подсчет файлов
            tasks_info = []
            initial_counts = {'photos': 0, 'videos': 0, 'other': 0}
            
            for post in posts:
                for file in post.get('files', []) or []:
                    path = file.get('path', '')
                    thumb = file.get('thumbnail', '')
                    if not path:
                        continue
                    
                    url_full = 'https://2ch.hk' + path
                    fname = Path(path).name
                    dest = base_dir / fname
                    ext = Path(fname).suffix.lower()
                    
                    if ext in IMAGE_EXTENSIONS:
                        initial_counts['photos'] += 1
                    elif ext in VIDEO_EXTENSIONS:
                        initial_counts['videos'] += 1
                    else:
                        initial_counts['other'] += 1
                    
                    tasks_info.append((url_full, str(dest), True))

                    if thumb:
                        url_thumb = 'https://2ch.hk' + thumb
                        fname_thumb = Path(thumb).name
                        dest_thumb = thumb_dir / fname_thumb
                        tasks_info.append((url_thumb, str(dest_thumb), False))

            total_files = len([t for t in tasks_info if t[2]])  # Только оригиналы
            
            # Обновляем статус: начало загрузки файлов
            task.update_state(
                state='PROGRESS',
                meta={
                    'status': 'downloading_files',
                    'progress': 10,
                    'total_files': total_files,
                    'downloaded': 0
                }
            )

            # Загрузка файлов
            stats = {'photos': 0, 'videos': 0, 'other': 0}
            failures = []
            sem = asyncio.Semaphore(8)

            # Загружаем файлы батчами для отслеживания прогресса
            batch_size = 10
            for i in range(0, len(tasks_info), batch_size):
                batch = tasks_info[i:i + batch_size]
                tasks = [
                    handle_download(session, url, dest, is_original, sem, stats, failures)
                    for url, dest, is_original in batch
                ]
                await asyncio.gather(*tasks)
                
                # Обновляем прогресс
                downloaded = stats['photos'] + stats['videos'] + stats['other']
                progress = 10 + int((downloaded / total_files) * 85) if total_files > 0 else 95
                
                task.update_state(
                    state='PROGRESS',
                    meta={
                        'status': 'downloading_files',
                        'progress': progress,
                        'total_files': total_files,
                        'downloaded': downloaded,
                        'stats': stats
                    }
                )

            # Повторная попытка для неудавшихся
            if failures:
                retry_failures = []
                retry_tasks = [
                    handle_download(session, url, dest, is_original, sem, stats, retry_failures)
                    for url, dest, is_original in failures
                ]
                await asyncio.gather(*retry_tasks)
                
                if retry_failures:
                    result['errors'] = [
                        {'url': url, 'dest': dest} 
                        for url, dest, _ in retry_failures
                    ]

            # Финальная статистика
            result['stats'] = {
                'photos': stats['photos'],
                'videos': stats['videos'],
                'other': stats['other'],
                'total': stats['photos'] + stats['videos'] + stats['other']
            }
            result['status'] = 'completed'
            result['completed_at'] = datetime.utcnow().isoformat()

    except Exception as e:
        result['status'] = 'failed'
        result['error'] = str(e)
        result['completed_at'] = datetime.utcnow().isoformat()
        raise

    return result


@celery_app.task(bind=True, base=CallbackTask, name='download_thread')
def download_thread(self, thread_id: str) -> Dict[str, Any]:
    """Celery задача для загрузки треда"""
    # Запускаем асинхронную функцию в синхронном контексте
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        result = loop.run_until_complete(download_thread_async(thread_id, self))
        return result
    finally:
        loop.close()


def get_task_info(task_id: str) -> Dict[str, Any]:
    """Получение информации о задаче"""
    result = AsyncResult(task_id, app=celery_app)
    
    if result.state == 'PENDING':
        return {
            'task_id': task_id,
            'state': 'PENDING',
            'status': 'Task not found or not started',
            'progress': 0
        }
    elif result.state == 'PROGRESS':
        return {
            'task_id': task_id,
            'state': result.state,
            'current': result.info.get('current', 0),
            'total': result.info.get('total', 1),
            'status': result.info.get('status', ''),
            'progress': result.info.get('progress', 0),
            **result.info
        }
    elif result.state == 'SUCCESS':
        return {
            'task_id': task_id,
            'state': result.state,
            'result': result.result,
            'progress': 100
        }
    else:  # FAILURE
        return {
            'task_id': task_id,
            'state': result.state,
            'error': str(result.info),
            'progress': 0
        } 