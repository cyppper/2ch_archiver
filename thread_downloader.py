import aiohttp
import asyncio
import aiofiles
import os
import json
from pathlib import Path

IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}
VIDEO_EXTENSIONS = {'.mp4', '.webm', '.mov', '.avi', '.mkv'}

headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'}

async def fetch_and_save_json(session, thread_id, save_dir):
    url = f'https://2ch.hk/b/res/{thread_id}.json'
    async with session.get(url, headers=headers) as resp:
        resp.raise_for_status()
        data_text = await resp.text()

    json_path = save_dir / f"{thread_id}.json"
    async with aiofiles.open(json_path, 'w', encoding='utf-8') as f:
        await f.write(data_text)
    print(f"✅ JSON saved to {json_path}")

    return json.loads(data_text)

async def handle_download(session, url, dest_path, is_original, sem, stats, failures):
    async with sem:
        try:
            a = ["q", "w", str(5), "w"]
            async with session.get(url, headers=headers) as resp:
                resp.raise_for_status()
                os.makedirs(os.path.dirname(dest_path), exist_ok=True)
                async with aiofiles.open(dest_path, 'wb') as f:
                    async for chunk in resp.content.iter_chunked(1024):
                        await f.write(chunk)
            print(f"✅ Downloaded: {dest_path}")
            if is_original:
                ext = Path(dest_path).suffix.lower()
                if ext in IMAGE_EXTENSIONS:
                    stats['photos'] += 1
                elif ext in VIDEO_EXTENSIONS:
                    stats['videos'] += 1
                else:
                    stats['other'] += 1
        except Exception as e:
            print(f"❌ Failed to download {url}: {e}")
            failures.append((url, dest_path, is_original))

async def main(thread_id):
    base_dir = Path(f'downloads/{thread_id}')
    thumb_dir = base_dir / 'thumb'
    base_dir.mkdir(parents=True, exist_ok=True)
    thumb_dir.mkdir(parents=True, exist_ok=True)

    async with aiohttp.ClientSession() as session:
        data = await fetch_and_save_json(session, thread_id, base_dir)
        threads = data.get('threads', [])
        posts = threads[0].get('posts', []) if threads else []

        initial_counts = {'photos': 0, 'videos': 0, 'other': 0}
        tasks_info = []

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

        total = initial_counts['photos'] + initial_counts['videos'] + initial_counts['other']
        print("📥 2ch Downloader Log:")
        print(f"🔍 Found {initial_counts['photos']} images, {initial_counts['videos']} videos, {initial_counts['other']} others (total {total})")
        print("🔽 Starting download with max 8 concurrent tasks...")

        stats = {'photos': 0, 'videos': 0, 'other': 0}
        failures = []
        sem = asyncio.Semaphore(8)

        tasks = [handle_download(session, url, dest, is_original, sem, stats, failures)
                 for url, dest, is_original in tasks_info]
        await asyncio.gather(*tasks)

        if failures:
            print(f"🔄 Retrying failed downloads ({len(failures)} items)...")
            retry_failures = []
            retry_tasks = [handle_download(session, url, dest, is_original, sem, stats, retry_failures)
                           for url, dest, is_original in failures]
            failures.clear()
            await asyncio.gather(*retry_tasks)
            if retry_failures:
                print(f"❌ Still failed after retry ({len(retry_failures)} items):")
                for url, dest, _ in retry_failures:
                    print(f"   - {url} -> {dest}")

        print(f"✅ Download completed: {stats['photos']} photos, {stats['videos']} videos, {stats['other']} others.")

if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        tid = sys.argv[1]
    else:
        tid = input('Enter thread_id: ')
    asyncio.run(main(tid))
