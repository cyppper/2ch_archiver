from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
import os
from pathlib import Path
from datetime import datetime

from celery_tasks import celery_app, download_thread, get_task_info

app = FastAPI(
    title="2ch Thread Downloader API",
    description="API для управления загрузкой тредов с 2ch.hk",
    version="1.0.0"
)

# Pydantic модели
class DownloadRequest(BaseModel):
    thread_id: str = Field(..., description="ID треда для загрузки", example="123456")

class DownloadResponse(BaseModel):
    task_id: str = Field(..., description="ID задачи Celery")
    thread_id: str = Field(..., description="ID треда")
    status: str = Field(..., description="Статус задачи")
    message: str = Field(..., description="Сообщение о запуске")

class StatusResponse(BaseModel):
    task_id: str = Field(..., description="ID задачи")
    thread_id: str = Field(..., description="ID треда")
    state: str = Field(..., description="Состояние задачи (PENDING, PROGRESS, SUCCESS, FAILURE)")
    progress: int = Field(..., description="Прогресс выполнения в процентах (0-100)")
    status: str = Field(..., description="Текущий статус выполнения")
    stats: Optional[Dict[str, int]] = Field(None, description="Статистика загруженных файлов")
    total_files: Optional[int] = Field(None, description="Общее количество файлов")
    downloaded: Optional[int] = Field(None, description="Количество загруженных файлов")
    result: Optional[Dict[str, Any]] = Field(None, description="Результат выполнения задачи")
    error: Optional[str] = Field(None, description="Описание ошибки, если есть")

class ErrorResponse(BaseModel):
    detail: str = Field(..., description="Описание ошибки")


# Хранилище для связи thread_id с task_id
# В продакшене лучше использовать Redis или базу данных
thread_tasks: Dict[str, str] = {}


@app.post(
    "/download/{thread_id}",
    response_model=DownloadResponse,
    responses={
        200: {"description": "Задача успешно запущена"},
        400: {"model": ErrorResponse, "description": "Неверный формат thread_id"},
        409: {"model": ErrorResponse, "description": "Задача для этого треда уже выполняется"}
    },
    summary="Запустить загрузку треда",
    description="Запускает асинхронную задачу загрузки треда через Celery"
)
async def start_download(thread_id: str):
    """
    Запускает задачу загрузки треда.
    
    - **thread_id**: ID треда на 2ch.hk (только цифры)
    """
    # Валидация thread_id
    if not thread_id.isdigit():
        raise HTTPException(
            status_code=400,
            detail="thread_id должен содержать только цифры"
        )
    
    # Проверяем, не загружается ли уже этот тред
    if thread_id in thread_tasks:
        existing_task_id = thread_tasks[thread_id]
        task_info = get_task_info(existing_task_id)
        
        if task_info['state'] in ['PENDING', 'PROGRESS']:
            raise HTTPException(
                status_code=409,
                detail=f"Тред {thread_id} уже загружается. Task ID: {existing_task_id}"
            )
    
    # Проверяем, не существует ли уже тред
    thread_path = Path(f'downloads/{thread_id}/{thread_id}.json')
    if thread_path.exists():
        # Можно либо вернуть ошибку, либо перезагрузить
        # Для примера разрешим перезагрузку
        pass
    
    # Запускаем задачу
    task = download_thread.delay(thread_id)
    thread_tasks[thread_id] = task.id
    
    return DownloadResponse(
        task_id=task.id,
        thread_id=thread_id,
        status="started",
        message=f"Задача загрузки треда {thread_id} запущена"
    )


@app.get(
    "/status/{thread_id}",
    response_model=StatusResponse,
    responses={
        200: {"description": "Статус задачи получен"},
        404: {"model": ErrorResponse, "description": "Задача для треда не найдена"},
        400: {"model": ErrorResponse, "description": "Неверный формат thread_id"}
    },
    summary="Получить статус загрузки треда",
    description="Возвращает текущий прогресс и статус загрузки треда"
)
async def get_download_status(thread_id: str):
    """
    Получает статус загрузки треда.
    
    - **thread_id**: ID треда на 2ch.hk (только цифры)
    
    Возможные состояния:
    - **PENDING**: Задача в очереди
    - **PROGRESS**: Задача выполняется
    - **SUCCESS**: Задача успешно завершена
    - **FAILURE**: Задача завершилась с ошибкой
    """
    # Валидация thread_id
    if not thread_id.isdigit():
        raise HTTPException(
            status_code=400,
            detail="thread_id должен содержать только цифры"
        )
    
    # Ищем task_id для этого треда
    if thread_id not in thread_tasks:
        # Проверяем, может тред уже загружен
        thread_path = Path(f'downloads/{thread_id}/{thread_id}.json')
        if thread_path.exists():
            # Получаем информацию о файлах
            stats = {'photos': 0, 'videos': 0, 'other': 0, 'total': 0}
            
            try:
                download_dir = Path(f'downloads/{thread_id}')
                for file in download_dir.iterdir():
                    if file.is_file() and file.suffix.lower() in {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}:
                        stats['photos'] += 1
                    elif file.is_file() and file.suffix.lower() in {'.mp4', '.webm', '.mov', '.avi', '.mkv'}:
                        stats['videos'] += 1
                    elif file.is_file() and file.name != f'{thread_id}.json':
                        stats['other'] += 1
                
                stats['total'] = stats['photos'] + stats['videos'] + stats['other']
            except:
                pass
            
            return StatusResponse(
                task_id="completed",
                thread_id=thread_id,
                state="SUCCESS",
                progress=100,
                status="Тред уже загружен",
                stats=stats,
                result={
                    'thread_id': thread_id,
                    'status': 'completed',
                    'stats': stats
                }
            )
        
        raise HTTPException(
            status_code=404,
            detail=f"Задача загрузки для треда {thread_id} не найдена"
        )
    
    task_id = thread_tasks[thread_id]
    task_info = get_task_info(task_id)
    
    # Формируем ответ
    response = StatusResponse(
        task_id=task_id,
        thread_id=thread_id,
        state=task_info['state'],
        progress=task_info.get('progress', 0),
        status=task_info.get('status', 'Unknown')
    )
    
    # Добавляем дополнительную информацию в зависимости от состояния
    if task_info['state'] == 'PROGRESS':
        response.stats = task_info.get('stats')
        response.total_files = task_info.get('total_files')
        response.downloaded = task_info.get('downloaded')
    elif task_info['state'] == 'SUCCESS':
        response.result = task_info.get('result')
        if response.result and 'stats' in response.result:
            response.stats = response.result['stats']
    elif task_info['state'] == 'FAILURE':
        response.error = task_info.get('error', 'Unknown error')
    
    return response


@app.get(
    "/",
    summary="Корневой эндпоинт",
    description="Возвращает информацию об API"
)
async def root():
    """Информация об API"""
    return {
        "title": "2ch Thread Downloader API",
        "version": "1.0.0",
        "endpoints": {
            "download": "POST /download/{thread_id}",
            "status": "GET /status/{thread_id}"
        },
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health")
async def health_check():
    """Проверка здоровья сервиса"""
    try:
        # Проверяем подключение к Celery
        i = celery_app.control.inspect()
        stats = i.stats()
        
        return {
            "status": "healthy",
            "celery_connected": stats is not None,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001) 