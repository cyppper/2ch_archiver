/**
 * Скрипт для popup окна расширения
 * Показывает статус и быстрые действия
 */

// Элементы интерфейса
const elements = {
  apiStatus: document.getElementById('apiStatus'),
  openCurrentThread: document.getElementById('openCurrentThread'),
  downloadCurrentThread: document.getElementById('downloadCurrentThread'),
  recentDownloads: document.getElementById('recentDownloads'),
  openOptions: document.getElementById('openOptions'),
  openHelp: document.getElementById('openHelp')
};

// Текущая вкладка
let currentTab = null;

/**
 * Инициализация popup
 */
async function init() {
  // Получаем текущую вкладку
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tabs[0];
  
  // Проверяем статус API
  await checkApiStatus();
  
  // Обновляем UI в зависимости от текущей страницы
  updateUIForCurrentTab();
  
  // Загружаем последние загрузки
  loadRecentDownloads();
  
  // Устанавливаем обработчики событий
  setupEventHandlers();
}

/**
 * Проверка статуса API
 */
async function checkApiStatus() {
  try {
    const settings = await chrome.storage.sync.get(['apiUrl']);
    const apiUrl = settings.apiUrl || 'http://localhost/api';
    
    updateApiStatus('checking');
    
    // Пробуем подключиться к API
    const response = await fetch(`${apiUrl}/health`, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache'
    });
    
    if (response.ok) {
      updateApiStatus('online');
    } else {
      updateApiStatus('error');
    }
  } catch (error) {
    console.error('Ошибка при проверке API:', error);
    updateApiStatus('offline');
  }
}

/**
 * Обновление индикатора статуса API
 */
function updateApiStatus(status) {
  const statusDot = elements.apiStatus.querySelector('.status-dot');
  const statusText = elements.apiStatus.querySelector('.status-text');
  
  // Удаляем все классы статуса
  statusDot.className = 'status-dot';
  
  switch (status) {
    case 'checking':
      statusDot.classList.add('checking');
      statusText.textContent = 'Проверка...';
      break;
    case 'online':
      statusDot.classList.add('online');
      statusText.textContent = 'API доступен';
      break;
    case 'offline':
      statusDot.classList.add('offline');
      statusText.textContent = 'API недоступен';
      break;
    case 'error':
      statusDot.classList.add('error');
      statusText.textContent = 'Ошибка подключения';
      break;
  }
}

/**
 * Обновление UI для текущей вкладки
 */
function updateUIForCurrentTab() {
  if (!currentTab) return;
  
  const is2chThread = currentTab.url && 
                     currentTab.url.includes('2ch.hk') && 
                     currentTab.url.includes('/res/');
  
  if (is2chThread) {
    // Активируем кнопки для треда 2ch
    elements.openCurrentThread.disabled = false;
    elements.downloadCurrentThread.disabled = false;
    
    // Извлекаем информацию о треде из URL
    const match = currentTab.url.match(/2ch\.hk\/([^\/]+)\/res\/(\d+)/);
    if (match) {
      const boardId = match[1];
      const threadId = match[2];
      elements.openCurrentThread.textContent = `📄 Открыть /${boardId}/${threadId}`;
    }
  } else {
    // Деактивируем кнопки, если не на странице треда
    elements.openCurrentThread.disabled = true;
    elements.downloadCurrentThread.disabled = true;
    elements.openCurrentThread.textContent = '📄 Не на странице треда';
  }
}

/**
 * Загрузка последних загрузок
 */
async function loadRecentDownloads() {
  try {
    const result = await chrome.storage.local.get(['recentDownloads']);
    const recentDownloads = result.recentDownloads || [];
    
    if (recentDownloads.length === 0) {
      elements.recentDownloads.innerHTML = '<p class="empty-message">Нет недавних загрузок</p>';
      return;
    }
    
    // Показываем последние 5 загрузок
    const downloadsHtml = recentDownloads
      .slice(0, 5)
      .map(download => `
        <div class="recent-item">
          <div class="recent-info">
            <span class="thread-id">/${download.boardId}/${download.threadId}</span>
            <span class="download-time">${formatTime(download.timestamp)}</span>
          </div>
          <span class="download-status ${download.status}">${getStatusText(download.status)}</span>
        </div>
      `)
      .join('');
    
    elements.recentDownloads.innerHTML = downloadsHtml;
  } catch (error) {
    console.error('Ошибка при загрузке истории:', error);
  }
}

/**
 * Форматирование времени
 */
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) { // Меньше минуты
    return 'Только что';
  } else if (diff < 3600000) { // Меньше часа
    const minutes = Math.floor(diff / 60000);
    return `${minutes} мин. назад`;
  } else if (diff < 86400000) { // Меньше суток
    const hours = Math.floor(diff / 3600000);
    return `${hours} ч. назад`;
  } else {
    return date.toLocaleDateString('ru-RU');
  }
}

/**
 * Получение текста статуса
 */
function getStatusText(status) {
  const statusMap = {
    'pending': '⏳ Ожидание',
    'progress': '🔄 Загрузка',
    'success': '✅ Готово',
    'error': '❌ Ошибка'
  };
  return statusMap[status] || status;
}

/**
 * Обработчики событий
 */
function setupEventHandlers() {
  // Открыть текущий тред
  elements.openCurrentThread.addEventListener('click', async () => {
    if (!currentTab) return;
    
    const match = currentTab.url.match(/2ch\.hk\/([^\/]+)\/res\/(\d+)/);
    if (match) {
      const boardId = match[1];
      const threadId = match[2];
      
      // Получаем URL нашего сервера
      const settings = await chrome.storage.sync.get(['apiUrl']);
      const apiUrl = settings.apiUrl || 'http://localhost/api';
      const serverUrl = apiUrl.replace('/api', '');
      
      // Открываем тред на нашем сервере
      chrome.tabs.create({
        url: `${serverUrl}/b/res/${threadId}.html`
      });
    }
  });
  
  // Скачать текущий тред
  elements.downloadCurrentThread.addEventListener('click', async () => {
    if (!currentTab) return;
    
    const match = currentTab.url.match(/2ch\.hk\/([^\/]+)\/res\/(\d+)/);
    if (match) {
      const boardId = match[1];
      const threadId = match[2];
      
      // Отправляем сообщение для скачивания
      try {
        elements.downloadCurrentThread.disabled = true;
        elements.downloadCurrentThread.textContent = '⏳ Отправка...';
        
        const response = await chrome.runtime.sendMessage({
          action: 'downloadThread',
          threadId: threadId,
          boardId: boardId
        });
        
        if (response.success) {
          elements.downloadCurrentThread.textContent = '✅ Отправлено';
          
          // Сохраняем в историю
          await saveToHistory(boardId, threadId, 'progress');
          
          // Обновляем список
          await loadRecentDownloads();
          
          setTimeout(() => {
            elements.downloadCurrentThread.textContent = '📥 Скачать текущий тред';
            elements.downloadCurrentThread.disabled = false;
          }, 2000);
        } else {
          throw new Error(response.error || 'Неизвестная ошибка');
        }
      } catch (error) {
        console.error('Ошибка при скачивании:', error);
        elements.downloadCurrentThread.textContent = '❌ Ошибка';
        setTimeout(() => {
          elements.downloadCurrentThread.textContent = '📥 Скачать текущий тред';
          elements.downloadCurrentThread.disabled = false;
        }, 2000);
      }
    }
  });
  
  // Открыть настройки
  elements.openOptions.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
  
  // Открыть помощь
  elements.openHelp.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({
      url: 'https://github.com/your-repo/wiki'
    });
  });
}

/**
 * Сохранение в историю загрузок
 */
async function saveToHistory(boardId, threadId, status) {
  try {
    const result = await chrome.storage.local.get(['recentDownloads']);
    let recentDownloads = result.recentDownloads || [];
    
    // Добавляем новую запись в начало
    recentDownloads.unshift({
      boardId: boardId,
      threadId: threadId,
      status: status,
      timestamp: Date.now()
    });
    
    // Оставляем только последние 20 записей
    recentDownloads = recentDownloads.slice(0, 20);
    
    await chrome.storage.local.set({ recentDownloads });
  } catch (error) {
    console.error('Ошибка при сохранении в историю:', error);
  }
}

// Запускаем инициализацию
init(); 