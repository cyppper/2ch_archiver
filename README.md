# 2ch Archiver

Сервис для скачивания и просмотра тредов с 2ch.hk. Веб-интерфейс, REST API, асинхронная загрузка через Celery. Оптимизирован для Raspberry Pi 4.

## Возможности

- Асинхронная загрузка тредов с отслеживанием прогресса
- REST API для управления загрузками
- Веб-интерфейс для просмотра скачанных тредов
- Автоматическая организация медиафайлов и превью
- Оптимизация для ARM (Raspberry Pi)
- Docker-ready

## Технологический стек

- **FastAPI** — основное приложение и API
- **Celery + Redis** — асинхронные задачи
- **aiohttp/aiofiles** — асинхронная загрузка файлов
- **NGINX** — веб-сервер и reverse proxy
- **Docker Compose** — оркестрация

## Структура проекта

```
.
├── api.py                 # REST API для управления загрузками
├── celery_tasks.py        # Асинхронные задачи Celery
├── saync_main.py          # Основное FastAPI приложение
├── manage.sh              # Скрипт управления сервисами
├── docker-compose.yml     # Конфигурация сервисов
├── Dockerfile             # Образ приложения
├── nginx.conf             # Конфигурация NGINX
├── requirements.txt       # Python зависимости
├── static/                # Статические файлы
├── templates/             # HTML шаблоны
│   ├── index.html         # Просмотр треда
│   └── catalog.html       # Каталог тредов
└── downloads/             # Скачанные треды
    └── {thread_id}/
        ├── {thread_id}.json
        ├── thumb/
        └── *.{jpg,png,webm}
```

## Быстрый старт

### Docker Compose (рекомендуется)

```bash
chmod +x manage.sh
./manage.sh start
```

### Локально

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Terminal 1
celery -A celery_tasks worker --loglevel=info --concurrency=2

# Terminal 2
uvicorn api:app --host 0.0.0.0 --port 8001

# Terminal 3
uvicorn saync_main:app --host 0.0.0.0 --port 8000
```

## Использование

| URL | Описание |
|-----|----------|
| `http://localhost/` | Каталог тредов |
| `http://localhost/b/res/{id}.html` | Просмотр треда |
| `http://localhost/api/docs` | Swagger документация |

```bash
# Запустить загрузку треда
curl -X POST http://localhost/api/download/123456

# Проверить статус
curl http://localhost/api/status/123456
```

## API Endpoints

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/` | Редирект на каталог |
| GET | `/b/catalog.json` | JSON каталог тредов |
| GET | `/b/catalog.html` | HTML каталог тредов |
| GET | `/b/res/{id}.html` | HTML страница треда |
| GET | `/b/res/{id}.json` | JSON данные треда |
| POST | `/api/download/{id}` | Запустить загрузку |
| GET | `/api/status/{id}` | Статус загрузки |
| GET | `/api/health` | Healthcheck |
| GET | `/api/docs` | Swagger |

## Управление

```bash
./manage.sh start              # Запустить
./manage.sh stop               # Остановить
./manage.sh restart            # Перезапустить
./manage.sh status             # Статус
./manage.sh logs [service]     # Логи
./manage.sh download <id>      # Загрузить тред
./manage.sh update             # Обновить образы
./manage.sh cleanup            # Очистить неиспользуемое
./manage.sh memory             # Проверить память
```

## Конфигурация

Переменные окружения (можно задать в `.env`):

```bash
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0
```

## Отладка

```bash
./manage.sh logs celery
./manage.sh logs api
./manage.sh logs nginx
```

**Частые проблемы:**

- `Connection refused` — убедитесь, что Redis запущен (`docker-compose ps`)
- Треды не загружаются — проверьте доступность 2ch.hk и логи Celery
