#!/bin/bash

# Скрипт для управления 2ch Indexer на Raspberry Pi 4

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Функция для вывода сообщений
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Проверка архитектуры
check_architecture() {
    ARCH=$(uname -m)
    if [[ "$ARCH" != "aarch64" && "$ARCH" != "armv7l" ]]; then
        warning "Обнаружена архитектура $ARCH. Этот проект оптимизирован для ARM (Raspberry Pi)."
    else
        log "Архитектура ARM обнаружена: $ARCH"
    fi
}

# Проверка Docker
check_docker() {
    if ! command -v docker &> /dev/null; then
        error "Docker не установлен. Установите Docker и Docker Compose."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose не установлен."
        exit 1
    fi
    
    log "Docker и Docker Compose установлены"
}

# Создание необходимых директорий
create_directories() {
    log "Создание необходимых директорий..."
    mkdir -p downloads static templates
    log "Директории созданы"
}

# Запуск всех сервисов
start_all() {
    log "Запуск всех сервисов..."
    docker-compose up -d
    log "Все сервисы запущены"
    show_status
}

# Запуск с мониторингом
start_with_monitoring() {
    log "Запуск всех сервисов с мониторингом..."
    docker-compose --profile monitoring up -d
    log "Все сервисы запущены включая Flower"
    show_status
}

# Остановка всех сервисов
stop_all() {
    log "Остановка всех сервисов..."
    docker-compose down
    log "Все сервисы остановлены"
}

# Перезапуск всех сервисов
restart_all() {
    stop_all
    start_all
}

# Показать статус
show_status() {
    echo ""
    log "Статус сервисов:"
    docker-compose ps
    echo ""
    log "Доступные endpoints:"
    echo "  - Основной сайт: http://localhost"
    echo "  - API документация: http://localhost/api/docs"
    echo "  - API endpoints: http://localhost/api/"
    if docker-compose ps | grep -q "flower.*Up"; then
        echo "  - Flower (мониторинг): http://localhost/flower/"
    fi
}

# Просмотр логов
show_logs() {
    SERVICE=$1
    if [ -z "$SERVICE" ]; then
        docker-compose logs -f --tail=100
    else
        docker-compose logs -f --tail=100 $SERVICE
    fi
}

# Загрузка треда
download_thread() {
    THREAD_ID=$1
    if [ -z "$THREAD_ID" ]; then
        error "Укажите ID треда"
        echo "Использование: $0 download <thread_id>"
        exit 1
    fi
    
    log "Запуск загрузки треда $THREAD_ID..."
    curl -X POST "http://localhost/api/download/$THREAD_ID"
    echo ""
    log "Проверить статус: http://localhost/api/status/$THREAD_ID"
}

# Обновление образов
update_images() {
    log "Обновление Docker образов..."
    docker-compose pull
    log "Пересборка локальных образов..."
    docker-compose build --no-cache
    log "Образы обновлены"
}

# Очистка неиспользуемых ресурсов
cleanup() {
    log "Очистка неиспользуемых Docker ресурсов..."
    docker system prune -f
    log "Очистка завершена"
}

# Проверка памяти
check_memory() {
    TOTAL_MEM=$(free -m | awk 'NR==2{print $2}')
    USED_MEM=$(free -m | awk 'NR==2{print $3}')
    FREE_MEM=$(free -m | awk 'NR==2{print $4}')
    
    log "Память системы:"
    echo "  - Всего: ${TOTAL_MEM}MB"
    echo "  - Использовано: ${USED_MEM}MB"
    echo "  - Свободно: ${FREE_MEM}MB"
    
    if [ $FREE_MEM -lt 1000 ]; then
        warning "Мало свободной памяти! Рекомендуется иметь минимум 1GB свободной памяти."
    fi
}

# Главное меню
case "$1" in
    start)
        check_architecture
        check_docker
        check_memory
        create_directories
        start_all
        ;;
    start-monitoring)
        check_architecture
        check_docker
        check_memory
        create_directories
        start_with_monitoring
        ;;
    stop)
        stop_all
        ;;
    restart)
        restart_all
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs $2
        ;;
    download)
        download_thread $2
        ;;
    update)
        update_images
        ;;
    cleanup)
        cleanup
        ;;
    memory)
        check_memory
        ;;
    *)
        echo "2ch Indexer Manager для Raspberry Pi 4"
        echo ""
        echo "Использование: $0 {start|start-monitoring|stop|restart|status|logs|download|update|cleanup|memory}"
        echo ""
        echo "Команды:"
        echo "  start            - Запустить все основные сервисы"
        echo "  start-monitoring - Запустить все сервисы включая Flower"
        echo "  stop             - Остановить все сервисы"
        echo "  restart          - Перезапустить все сервисы"
        echo "  status           - Показать статус сервисов"
        echo "  logs [service]   - Показать логи (опционально указать сервис)"
        echo "  download <id>    - Загрузить тред по ID"
        echo "  update           - Обновить Docker образы"
        echo "  cleanup          - Очистить неиспользуемые Docker ресурсы"
        echo "  memory           - Проверить использование памяти"
        echo ""
        echo "Примеры:"
        echo "  $0 start"
        echo "  $0 logs celery"
        echo "  $0 download 123456"
        exit 1
        ;;
esac 