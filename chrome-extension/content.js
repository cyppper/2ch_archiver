/**
 * Content Script для внедрения кнопки скачивания треда на 2ch.hk
 * Работает на всех страницах 2ch.hk и добавляет функционал скачивания
 */

// Ждем полной загрузки DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initExtension);
} else {
  initExtension();
}

/**
 * Инициализация расширения
 */
function initExtension() {
  console.log('2ch Thread Downloader: Инициализация...');
  
  // Проверяем, что мы на странице треда
  if (isThreadPage()) {
    // Небольшая задержка для гарантии загрузки всех элементов
    setTimeout(() => {
      injectDownloadButton();
      observeThreadChanges();
    }, 1000);
  }
}

/**
 * Проверка, находимся ли мы на странице треда
 * @returns {boolean}
 */
function isThreadPage() {
  // Проверяем URL - должен содержать /res/
  const isThread = window.location.pathname.includes('/res/');
  console.log(`2ch Thread Downloader: Страница треда: ${isThread}`);
  return isThread;
}

/**
 * Получение ID треда и доски из URL
 * @returns {{boardId: string, threadId: string} | null}
 */
function getThreadInfo() {
  // URL формата: https://2ch.hk/b/res/123456.html
  const match = window.location.pathname.match(/\/([^\/]+)\/res\/(\d+)/);
  if (match) {
    return {
      boardId: match[1],
      threadId: match[2]
    };
  }
  return null;
}

/**
 * Внедрение кнопки скачивания в панель управления тредом
 */
function injectDownloadButton() {
  console.log('2ch Thread Downloader: Поиск панели управления...');
  
  // Ищем панель управления тредом
  // Селектор: body > div.cntnt > main > div:nth-child(1) > div.tn__item.desktop
  const toolbarSelector = 'div.tn__item.desktop';
  const toolbars = document.querySelectorAll(toolbarSelector);
  
  if (toolbars.length === 0) {
    console.warn('2ch Thread Downloader: Панель управления не найдена');
    return;
  }
  
  // Добавляем кнопку во все найденные панели (обычно их две - сверху и снизу)
  toolbars.forEach((toolbar, index) => {
    // Проверяем, не добавлена ли уже кнопка
    if (toolbar.querySelector('.thread-downloader-btn')) {
      console.log(`2ch Thread Downloader: Кнопка уже существует в панели ${index + 1}`);
      return;
    }
    
    // Создаем кнопку
    const downloadButton = createDownloadButton();
    
    // Вставляем кнопку в конец панели инструментов
    toolbar.appendChild(downloadButton);
    console.log(`2ch Thread Downloader: Кнопка добавлена в панель ${index + 1}`);
  });
}

/**
 * Создание кнопки скачивания
 * @returns {HTMLElement}
 */
function createDownloadButton() {
  // Создаем контейнер для кнопки в стиле 2ch
  const buttonContainer = document.createElement('span');
  buttonContainer.className = 'thread-downloader-container';
  
  // Создаем саму кнопку
  const button = document.createElement('button');
  button.className = 'thread-downloader-btn';
  button.textContent = '📥 Скачать тред';
  button.title = 'Скачать тред через API';
  
  // Добавляем обработчик клика
  button.addEventListener('click', handleDownloadClick);
  
  buttonContainer.appendChild(button);
  return buttonContainer;
}

/**
 * Обработчик клика по кнопке скачивания
 * @param {Event} event
 */
async function handleDownloadClick(event) {
  event.preventDefault();
  
  const button = event.target;
  const originalText = button.textContent;
  
  // Получаем информацию о треде
  const threadInfo = getThreadInfo();
  if (!threadInfo) {
    showError('Не удалось определить ID треда');
    return;
  }
  
  try {
    // Меняем текст кнопки на время загрузки
    button.textContent = '⏳ Отправка...';
    button.disabled = true;
    
    console.log(`2ch Thread Downloader: Отправка треда ${threadInfo.threadId} на загрузку...`);
    
    // Отправляем сообщение в background script
    const response = await chrome.runtime.sendMessage({
      action: 'downloadThread',
      threadId: threadInfo.threadId,
      boardId: threadInfo.boardId,
      sourceHost: window.location.hostname
    });
    
    if (response.success) {
      button.textContent = '✅ Отправлено';
      console.log('2ch Thread Downloader: Тред успешно отправлен на загрузку', response.data);
      
      // Возвращаем исходный текст через 3 секунды
      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
      }, 3000);
    } else {
      throw new Error(response.error || 'Неизвестная ошибка');
    }
    
  } catch (error) {
    console.error('2ch Thread Downloader: Ошибка при отправке треда:', error);
    button.textContent = '❌ Ошибка';
    showError(`Ошибка: ${error.message}`);
    
    // Возвращаем исходный текст через 3 секунды
    setTimeout(() => {
      button.textContent = originalText;
      button.disabled = false;
    }, 3000);
  }
}

/**
 * Показ ошибки пользователю
 * @param {string} message
 */
function showError(message) {
  // Создаем временное уведомление об ошибке
  const notification = document.createElement('div');
  notification.className = 'thread-downloader-error';
  notification.textContent = message;
  
  // Добавляем в body
  document.body.appendChild(notification);
  
  // Удаляем через 5 секунд
  setTimeout(() => {
    notification.remove();
  }, 5000);
}

/**
 * Наблюдение за изменениями DOM для динамически загружаемого контента
 * Некоторые элементы могут загружаться асинхронно
 */
function observeThreadChanges() {
  const observer = new MutationObserver((mutations) => {
    // Проверяем, не появились ли новые панели инструментов
    const hasNewToolbar = mutations.some(mutation => {
      return Array.from(mutation.addedNodes).some(node => {
        return node.nodeType === 1 && (
          node.matches?.('div.tn__item.desktop') ||
          node.querySelector?.('div.tn__item.desktop')
        );
      });
    });
    
    if (hasNewToolbar) {
      console.log('2ch Thread Downloader: Обнаружены новые панели инструментов');
      injectDownloadButton();
    }
  });
  
  // Наблюдаем за изменениями в body
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

/**
 * Проверка наличия настроек API при загрузке
 */
async function checkApiSettings() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getApiUrl' });
    if (!response.apiUrl || response.apiUrl === 'http://localhost/api') {
      console.warn('2ch Thread Downloader: API URL не настроен. Используется значение по умолчанию.');
    }
  } catch (error) {
    console.error('2ch Thread Downloader: Ошибка при проверке настроек:', error);
  }
}

// Проверяем настройки при загрузке
checkApiSettings(); 