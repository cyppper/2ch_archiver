# 2ch Indexer

Полнофункциональный сервис для индексации, скачивания и просмотра тредов с 2ch.hk. Включает веб-интерфейс, REST API и асинхронную загрузку через Celery. Оптимизирован для работы на Raspberry Pi 4.

## 🚀 Возможности

- **Асинхронная загрузка тредов** с отслеживанием прогресса в реальном времени
- **REST API** для управления загрузками
- **Веб-интерфейс** для просмотра скачанных тредов
- **Автоматическая организация** медиафайлов и превью
- **Мониторинг задач** через Flower
- **Оптимизация для ARM** (Raspberry Pi)
- **Docker-ready** архитектура с orchestration

## 📋 Требования

- Docker и Docker Compose
- Для локального запуска: Python 3.11+, Redis
- Минимум 2GB RAM (рекомендуется 4GB+)
- Для Raspberry Pi: модель 4 с 4GB+ RAM

## 🛠 Технологический стек

### Backend
- **FastAPI** - основное приложение и API
- **Celery** - асинхронные задачи
- **Redis** - брокер сообщений и кеш
- **aiohttp/aiofiles** - асинхронная работа с файлами
- **Uvicorn** - ASGI сервер

### Frontend
- **Jinja2** - шаблонизатор
- **Vanilla JS** - интерактивность

### Инфраструктура
- **Docker & Docker Compose** - контейнеризация
- **NGINX** - веб-сервер и reverse proxy
- **Flower** - мониторинг Celery (опционально)

## 📁 Структура проекта

```
.
├── api.py                 # REST API для управления загрузками
├── celery_tasks.py        # Асинхронные задачи Celery
├── saync_main.py          # Основное FastAPI приложение
├── thread_downloader.py   # Модуль загрузки тредов
├── manage.sh              # Скрипт управления сервисами
├── docker-compose.yml     # Конфигурация всех сервисов
├── Dockerfile             # Образ приложения
├── nginx.conf             # Конфигурация NGINX
├── requirements.txt       # Python зависимости
├── static/                # Статические файлы (CSS, JS, изображения)
├── templates/             # HTML шаблоны
│   ├── index.html         # Просмотр треда
│   └── catalog.html       # Каталог тредов
└── downloads/             # Скачанные треды
    └── {thread_id}/       # Папка конкретного треда
        ├── {thread_id}.json  # Метаданные треда
        ├── thumb/            # Превью изображений
        └── *.{jpg,png,webm}  # Медиафайлы
```

## 🚀 Быстрый старт

### Вариант 1: Docker Compose (рекомендуется)

1. **Клонируйте репозиторий:**
```bash
git clone [url-репозитория]
cd 2ch_indexer
```

2. **Запустите все сервисы:**
```bash
# Дайте права на выполнение скрипту управления
chmod +x manage.sh

# Запустите все сервисы
./manage.sh start

# Или с мониторингом Flower
./manage.sh start-monitoring
```

3. **Проверьте статус:**
```bash
./manage.sh status
```

### Вариант 2: Локальная установка

1. **Установите зависимости:**
```bash
# Создайте виртуальное окружение
python -m venv venv
source venv/bin/activate  # Linux/Mac
# или
venv\Scripts\activate  # Windows

# Установите пакеты
pip install -r requirements.txt
```

2. **Запустите Redis:**
```bash
# Ubuntu/Debian
sudo apt-get install redis-server
redis-server

# macOS
brew install redis
redis-server
```

3. **Запустите компоненты:**
```bash
# Terminal 1 - Celery Worker
celery -A celery_tasks worker --loglevel=info --concurrency=2

# Terminal 2 - API сервер
uvicorn api:app --host 0.0.0.0 --port 8001

# Terminal 3 - Основное приложение
uvicorn saync_main:app --host 0.0.0.0 --port 8000

# Terminal 4 - Flower (опционально)
celery -A celery_tasks flower --port=5555
```

## 📱 Использование

### Веб-интерфейс

- **Каталог тредов**: http://localhost/b/catalog.html
- **Просмотр треда**: http://localhost/b/res/{thread_id}.html
- **API документация**: http://localhost/api/docs
- **Мониторинг Celery**: http://localhost/flower/ (если включен)

### Загрузка тредов через API

```bash
# Запустить загрузку
curl -X POST http://localhost/api/download/123456

# Проверить статус
curl http://localhost/api/status/123456

# Использовать скрипт управления
./manage.sh download 123456
```

### Загрузка через командную строку

```bash
# Локально
python thread_downloader.py 123456

# Через Docker
docker-compose exec app python thread_downloader.py 123456
```

## 📡 API Endpoints

### Основное приложение

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/b/catalog.json` | JSON каталог всех тредов |
| GET | `/b/catalog.html` | HTML страница каталога |
| GET | `/b/res/{thread_id}.html` | HTML страница треда |
| GET | `/b/res/{thread_id}.json` | JSON данные треда |
| GET | `/b/src/{thread_id}/{file}` | Медиафайлы |
| GET | `/b/thumb/{thread_id}/{file}` | Превью |

### API управления загрузками

| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/download/{thread_id}` | Запустить загрузку треда |
| GET | `/api/status/{thread_id}` | Получить статус загрузки |
| GET | `/api/health` | Проверка здоровья сервиса |
| GET | `/api/docs` | Swagger документация |

## 🔧 Управление сервисами

Используйте скрипт `manage.sh` для управления:

```bash
./manage.sh start              # Запустить все сервисы
./manage.sh start-monitoring   # Запустить с Flower
./manage.sh stop               # Остановить все
./manage.sh restart            # Перезапустить
./manage.sh status             # Показать статус
./manage.sh logs [service]     # Просмотр логов
./manage.sh download <id>      # Загрузить тред
./manage.sh update             # Обновить образы Docker
./manage.sh cleanup            # Очистить неиспользуемое
./manage.sh memory             # Проверить память
```

## 🔒 Безопасность

1. **Измените пароль Flower** в `docker-compose.yml`:
```yaml
FLOWER_BASIC_AUTH=admin:your_secure_password
```

2. **Сетевая изоляция**: все сервисы работают в изолированной Docker сети

3. **Ограничение ресурсов**: настроены лимиты памяти для каждого контейнера

## ⚙️ Конфигурация

### Переменные окружения

Создайте файл `.env` на основе примера:

```bash
# Redis
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0

# Flower
FLOWER_BASIC_AUTH=admin:secure_password

# Порты
API_PORT=8001
APP_PORT=8000
NGINX_PORT=80
```

### Оптимизация для Raspberry Pi 4

В `docker-compose.yml` уже настроены:
- Ограничения памяти для каждого сервиса
- Уменьшенное количество воркеров Celery (2 вместо 4)
- Оптимизированные параметры NGINX
- Alpine-based образы где возможно

## 🐛 Отладка

### Просмотр логов
```bash
# Все логи
./manage.sh logs

# Логи конкретного сервиса
./manage.sh logs celery
./manage.sh logs api
./manage.sh logs nginx
```

### Частые проблемы

1. **"Connection refused" при запуске API**
   - Убедитесь, что Redis запущен
   - Проверьте `docker-compose ps`

2. **Недостаток памяти на Raspberry Pi**
   - Уменьшите concurrency в Celery
   - Отключите Flower если не используется
   - Проверьте swap: `free -h`

3. **Треды не загружаются**
   - Проверьте логи Celery: `./manage.sh logs celery`
   - Убедитесь в доступности 2ch.hk

## 📊 Мониторинг производительности

- **Flower**: http://localhost/flower/ - мониторинг задач Celery
- **Docker stats**: `docker stats` - использование ресурсов
- **Проверка памяти**: `./manage.sh memory`

## 🤝 Вклад в проект

1. Fork репозитория
2. Создайте feature branch (`git checkout -b feature/amazing`)
3. Commit изменения (`git commit -m 'Add amazing feature'`)
4. Push в branch (`git push origin feature/amazing`)
5. Откройте Pull Request

## 📄 Лицензия

[Укажите вашу лицензию]

## 🙏 Благодарности

- Разработчикам FastAPI, Celery и Docker
- Сообществу 2ch за контент
- Контрибьюторам проекта