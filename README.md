# 2ch Indexer

Сервис для индексации и просмотра тредов с 2ch.life. Позволяет скачивать треды, включая все медиафайлы, и предоставляет удобный веб-интерфейс для их просмотра.

## Возможности

- Скачивание тредов с 2ch.life
- Сохранение всех медиафайлов (изображения, видео)
- Сохранение превью (thumbnails)
- Веб-интерфейс для просмотра тредов
- Каталог всех скачанных тредов
- Асинхронная загрузка файлов
- Автоматический ретрай при ошибках загрузки

## Технологический стек

### Backend
- **FastAPI** - современный веб-фреймворк для создания API
- **Uvicorn** - ASGI-сервер для запуска FastAPI
- **aiohttp** - асинхронный HTTP-клиент для скачивания файлов
- **aiofiles** - асинхронная работа с файлами
- **Jinja2** - шаблонизатор для HTML-страниц

### Инфраструктура
- **Docker** - контейнеризация приложения
- **Docker Compose** - оркестрация контейнеров
- **NGINX** - прокси-сервер и балансировщик нагрузки

## Структура проекта

```
.
├── saync_main.py          # Основной файл FastAPI приложения
├── thread_downloader.py   # Скрипт для скачивания тредов
├── requirements.txt       # Зависимости Python
├── Dockerfile            # Конфигурация Docker-образа
├── docker-compose.yml    # Конфигурация Docker Compose
├── nginx.conf            # Конфигурация NGINX
├── static/               # Статические файлы (CSS, JS, изображения)
├── templates/            # HTML шаблоны
└── downloads/            # Директория для скачанных тредов
    └── {thread_id}/      # Поддиректории для каждого треда
        ├── {thread_id}.json  # JSON с данными треда
        ├── thumb/            # Превью изображений
        └── [media files]     # Медиафайлы треда
```

## Установка и запуск

### Локальная установка

1. Клонируйте репозиторий:
```bash
git clone [url-репозитория]
cd 2ch_indexer
```

2. Создайте виртуальное окружение и установите зависимости:
```bash
python -m venv venv
source venv/bin/activate  # для Linux/Mac
# или
venv\Scripts\activate  # для Windows
pip install -r requirements.txt
```

3. Создайте необходимые директории:
```bash
mkdir -p static templates downloads
```

4. Запустите приложение:
```bash
uvicorn saync_main:app --host 0.0.0.0 --port 8000
```

### Запуск через Docker

1. Убедитесь, что у вас установлены Docker и Docker Compose

2. Создайте необходимые директории:
```bash
mkdir -p static templates downloads
```

3. Запустите проект:
```bash
docker-compose up --build
```

Приложение будет доступно по адресу: http://localhost:8088

## Использование

### Скачивание треда

```bash
python thread_downloader.py [thread_id]
```

или через Docker:

```bash
docker-compose exec app python thread_downloader.py [thread_id]
```

### Просмотр тредов

- Каталог всех тредов: http://localhost:8088/b/catalog.html
- Просмотр конкретного треда: http://localhost:8088/b/res/[thread_id].html

## API Endpoints

- `GET /b/catalog.json` - JSON с каталогом тредов
- `GET /b/res/{thread_id}.json` - JSON с данными треда
- `GET /b/src/{thread_id}/{filename}` - доступ к медиафайлам
- `GET /b/thumb/{thread_id}/{filename}` - доступ к превью

## Масштабирование

Проект готов к масштабированию благодаря:
- Асинхронной архитектуре
- Контейнеризации
- NGINX в качестве прокси
- Изолированной сети между сервисами

## Безопасность

- Все входящие запросы проходят через NGINX
- Изолированная сеть между контейнерами
- Минимальный набор файлов в Docker-образе
- Только необходимые порты открыты наружу