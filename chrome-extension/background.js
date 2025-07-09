/**
 * Background Service Worker для Chrome Extension
 * Обрабатывает сообщения от content script и выполняет API запросы
 */

// Слушаем сообщения от content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'downloadThread') {
    handleThreadDownload(request.threadId, request.boardId)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    // Возвращаем true, чтобы указать, что ответ будет асинхронным
    return true;
  }
  
  if (request.action === 'getApiUrl') {
    chrome.storage.sync.get(['apiUrl'], (result) => {
      sendResponse({ apiUrl: result.apiUrl || 'http://localhost/api' });
    });
    return true;
  }
});

/**
 * Обработка загрузки треда
 * @param {string} threadId - ID треда для загрузки
 * @param {string} boardId - ID доски (например, 'b')
 */
async function handleThreadDownload(threadId, boardId) {
  try {
    // Получаем URL API из настроек
    const settings = await chrome.storage.sync.get(['apiUrl']);
    const apiUrl = settings.apiUrl || 'http://localhost/api';
    
    // Формируем URL для запроса
    const downloadUrl = `${apiUrl}/download/${threadId}`;
    
    console.log(`Отправляем запрос на загрузку треда ${threadId} на ${downloadUrl}`);
    
    // Выполняем запрос к API
    const response = await fetch(downloadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        board: boardId,
        thread_id: threadId
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Показываем уведомление об успешном запуске
    await showNotification(
      'Загрузка начата',
      `Тред ${threadId} отправлен на загрузку. Task ID: ${data.task_id}`,
      'success'
    );
    
    // Начинаем мониторинг статуса
    startStatusMonitoring(threadId, boardId, apiUrl);
    
    return data;
    
  } catch (error) {
    console.error('Ошибка при загрузке треда:', error);
    
    // Показываем уведомление об ошибке
    await showNotification(
      'Ошибка загрузки',
      `Не удалось отправить тред на загрузку: ${error.message}`,
      'error'
    );
    
    throw error;
  }
}

/**
 * Обновление статуса загрузки в локальном хранилище
 * @param {string} threadId - ID треда
 * @param {string} boardId - ID доски
 * @param {string} status - Новый статус
 */
async function updateDownloadStatus(threadId, boardId, status) {
  try {
    const result = await chrome.storage.local.get(['recentDownloads']);
    let recentDownloads = result.recentDownloads || [];
    
    // Находим запись с данным тредом и обновляем статус
    const index = recentDownloads.findIndex(download => 
      download.threadId === threadId && download.boardId === boardId
    );
    
    if (index !== -1) {
      recentDownloads[index].status = status;
      await chrome.storage.local.set({ recentDownloads });
    }
  } catch (error) {
    console.error('Ошибка при обновлении статуса:', error);
  }
}

/**
 * Мониторинг статуса загрузки
 * @param {string} threadId - ID треда
 * @param {string} boardId - ID доски
 * @param {string} apiUrl - URL API
 */
async function startStatusMonitoring(threadId, boardId, apiUrl) {
  const statusUrl = `${apiUrl}/status/${threadId}`;
  let attempts = 0;
  const maxAttempts = 60; // Максимум 5 минут (60 * 5 сек)
  
  // Устанавливаем статус в 'progress' при начале мониторинга
  await updateDownloadStatus(threadId, boardId, 'progress');
  
  const checkStatus = async () => {
    try {
      const response = await fetch(statusUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.state === 'SUCCESS') {
        await showNotification(
          'Загрузка завершена',
          `Тред ${threadId} успешно загружен! Файлов: ${data.stats?.total || 0}`,
          'success'
        );
        // Обновляем статус в хранилище
        await updateDownloadStatus(threadId, boardId, 'success');
        return;
      }
      
      if (data.state === 'FAILURE') {
        await showNotification(
          'Ошибка загрузки',
          `Загрузка треда ${threadId} завершилась с ошибкой: ${data.error || 'Неизвестная ошибка'}`,
          'error'
        );
        // Обновляем статус в хранилище
        await updateDownloadStatus(threadId, boardId, 'error');
        return;
      }
      
      // Если задача еще выполняется, проверяем снова через 5 секунд
      attempts++;
      if (attempts < maxAttempts && data.state === 'PROGRESS') {
        setTimeout(checkStatus, 5000);
      }
      
    } catch (error) {
      console.error('Ошибка при проверке статуса:', error);
      // В случае ошибки проверки статуса, устанавливаем статус ошибки
      await updateDownloadStatus(threadId, boardId, 'error');
    }
  };
  
  // Начинаем проверку через 2 секунды
  setTimeout(checkStatus, 2000);
}

/**
 * Показ уведомления
 * @param {string} title - Заголовок уведомления
 * @param {string} message - Текст уведомления
 * @param {string} type - Тип уведомления (success/error/info)
 */
async function showNotification(title, message, type = 'info') {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: '', // Оставляем пустым - Chrome покажет иконку по умолчанию
    title: title,
    message: message,
    priority: 2
  });
}

// Обработка установки расширения
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // При первой установке открываем страницу настроек
    chrome.runtime.openOptionsPage();
  }
}); 