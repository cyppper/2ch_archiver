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
 * Проверка и обновление статуса загрузки
 */
async function checkAndUpdateDownloadStatus() {
  try {
    const result = await chrome.storage.local.get(['recentDownloads']);
    let recentDownloads = result.recentDownloads || [];
    
    // Получаем настройки API
    const settings = await chrome.storage.sync.get(['apiUrl']);
    const apiUrl = settings.apiUrl || 'http://localhost/api';
    
    let updated = false;
    
    // Проверяем статус для всех загрузок со статусом 'progress'
    for (let i = 0; i < recentDownloads.length; i++) {
      const download = recentDownloads[i];
      
      // Проверяем только загрузки в процессе
      if (download.status === 'progress') {
        try {
          const statusUrl = `${apiUrl}/status/${download.threadId}`;
          const response = await fetch(statusUrl);
          
          if (response.ok) {
            const data = await response.json();
            
            if (data.state === 'SUCCESS') {
              recentDownloads[i].status = 'success';
              updated = true;
            } else if (data.state === 'FAILURE') {
              recentDownloads[i].status = 'error';
              updated = true;
            }
          }
        } catch (error) {
          console.error(`Ошибка при проверке статуса треда ${download.threadId}:`, error);
        }
      }
    }
    
    // Если были обновления, сохраняем и перезагружаем список
    if (updated) {
      await chrome.storage.local.set({ recentDownloads });
      await loadRecentDownloads();
    }
    
  } catch (error) {
    console.error('Ошибка при проверке статуса загрузок:', error);
  }
}

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
  
  // Проверяем и обновляем статус загрузок
  await checkAndUpdateDownloadStatus();
  
  // Загружаем последние загрузки
  loadRecentDownloads();
  
  // Устанавливаем обработчики событий
  setupEventHandlers();
  
  // Запускаем периодическое обновление статуса
  setInterval(checkAndUpdateDownloadStatus, 10000); // каждые 10 секунд
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
 * Получение первого сообщения треда
 * @param {string} boardId - ID доски
 * @param {string} threadId - ID треда
 * @returns {string} Обрезанный текст первого сообщения
 */
async function getThreadFirstMessage(boardId, threadId) {
  try {
    const settings = await chrome.storage.sync.get(['apiUrl']);
    const apiUrl = settings.apiUrl || 'http://localhost/api';
    
    // Сначала пробуем получить данные из нашего API (для уже загруженных тредов)
    try {
      const response = await fetch(`${apiUrl}/thread/${threadId}`, {
        method: 'GET',
        mode: 'cors',
        cache: 'default'
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Ищем первое сообщение
        if (data.posts && data.posts.length > 0) {
          const firstPost = data.posts[0];
          let message = firstPost.comment || '';
          
          // Убираем HTML теги
          message = message.replace(/<[^>]*>/g, '');
          
          // Убираем лишние пробелы и переносы строк
          message = message.replace(/\s+/g, ' ').trim();
          
          // Обрезаем до 50 символов
          if (message.length > 50) {
            message = message.substring(0, 47) + '...';
          }
          
          return message;
        }
      }
    } catch (localError) {
      console.log(`Тред ${threadId} не найден в локальном API, пробуем получить с 2ch.hk`);
    }
    
    // Если не получилось из нашего API, пробуем получить с 2ch.hk
    try {
      const response = await fetch(`https://2ch.hk/${boardId}/res/${threadId}.json`, {
        method: 'GET',
        mode: 'cors',
        cache: 'default'
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Ищем первое сообщение в массиве threads->posts
        if (data.threads && data.threads.length > 0 && data.threads[0].posts && data.threads[0].posts.length > 0) {
          const firstPost = data.threads[0].posts[0];
          let message = firstPost.comment || '';
          
          // Убираем HTML теги
          message = message.replace(/<[^>]*>/g, '');
          
          // Убираем лишние пробелы и переносы строк
          message = message.replace(/\s+/g, ' ').trim();
          
          // Обрезаем до 50 символов
          if (message.length > 50) {
            message = message.substring(0, 47) + '...';
          }
          
          return message;
        }
      }
    } catch (remoteError) {
      console.log(`Не удалось получить данные треда ${threadId} с 2ch.hk:`, remoteError);
    }
    
    return '';
  } catch (error) {
    console.error(`Ошибка при получении первого сообщения треда ${threadId}:`, error);
    return '';
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
    
    // Создаем HTML с заглушками для сообщений
    const downloadsHtml = recentDownloads
      .slice(0, 5)
      .map(download => {
        const messageText = download.firstMessage ? ` - ${download.firstMessage}` : '';
        return `
        <div class="recent-item clickable" data-board-id="${download.boardId}" data-thread-id="${download.threadId}">
          <div class="recent-info">
            <span class="thread-id-with-message">
              <span class="thread-id">/${download.boardId}/${download.threadId}</span>
              <span class="thread-message loaded">${messageText}</span>
            </span>
            <span class="download-time">${formatTime(download.timestamp)}</span>
          </div>
          <span class="download-status ${download.status}">${getStatusText(download.status)}</span>
        </div>
      `;
      })
      .join('');
    
    elements.recentDownloads.innerHTML = downloadsHtml;
    
    // Добавляем обработчики клика для элементов тредов
    setupRecentItemsClickHandlers();
    
    // Загружаем первые сообщения только для тех тредов, у которых их нет
    recentDownloads.slice(0, 5).forEach(async (download, index) => {
      if (!download.firstMessage) {
        const messageElement = document.querySelector(`[data-thread-id="${download.threadId}"] .thread-message`);
        if (messageElement) {
          messageElement.textContent = 'Загрузка...';
          messageElement.classList.remove('loaded');
          
          const firstMessage = await getThreadFirstMessage(download.boardId, download.threadId);
          if (firstMessage) {
            messageElement.textContent = ` - ${firstMessage}`;
            messageElement.classList.add('loaded');
            
            // Обновляем кэш
            const result = await chrome.storage.local.get(['recentDownloads']);
            let cachedDownloads = result.recentDownloads || [];
            const downloadIndex = cachedDownloads.findIndex(d => 
              d.threadId === download.threadId && d.boardId === download.boardId
            );
            if (downloadIndex !== -1) {
              cachedDownloads[downloadIndex].firstMessage = firstMessage;
              await chrome.storage.local.set({ recentDownloads: cachedDownloads });
            }
          } else {
            messageElement.textContent = '';
            messageElement.classList.add('loaded');
          }
        }
      }
    });
    
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
          await saveToHistory(boardId, threadId, 'pending');
          
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
    
    // Получаем первое сообщение треда для кэширования
    const firstMessage = await getThreadFirstMessage(boardId, threadId);
    
    // Добавляем новую запись в начало
    recentDownloads.unshift({
      boardId: boardId,
      threadId: threadId,
      status: status,
      timestamp: Date.now(),
      firstMessage: firstMessage || '' // Кэшируем первое сообщение
    });
    
    // Оставляем только последние 20 записей
    recentDownloads = recentDownloads.slice(0, 20);
    
    await chrome.storage.local.set({ recentDownloads });
  } catch (error) {
    console.error('Ошибка при сохранении в историю:', error);
  }
}

/**
 * Установка обработчиков кликов для элементов последних загрузок
 */
function setupRecentItemsClickHandlers() {
  document.querySelectorAll('.recent-item.clickable').forEach(item => {
    item.addEventListener('click', async () => {
      const boardId = item.dataset.boardId;
      const threadId = item.dataset.threadId;
      
      // Получаем URL нашего сервера
      const settings = await chrome.storage.sync.get(['apiUrl']);
      const apiUrl = settings.apiUrl || 'http://localhost/api';
      const serverUrl = apiUrl.replace('/api', '');
      
      // Открываем тред на нашем сервере
      chrome.tabs.create({
        url: `${serverUrl}/b/res/${threadId}.html`
      });
    });
  });
}

// Запускаем инициализацию
init(); 