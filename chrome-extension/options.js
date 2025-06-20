/**
 * Скрипт для страницы настроек расширения
 * Обрабатывает сохранение/загрузку настроек и проверку подключения
 */

// Элементы формы
const elements = {
  apiUrl: document.getElementById('apiUrl'),
  enableNotifications: document.getElementById('enableNotifications'),
  enableStatusMonitoring: document.getElementById('enableStatusMonitoring'),
  debugMode: document.getElementById('debugMode'),
  saveButton: document.getElementById('saveSettings'),
  resetButton: document.getElementById('resetSettings'),
  testButton: document.getElementById('testConnection'),
  testResult: document.getElementById('testResult'),
  statusMessage: document.getElementById('statusMessage'),
  helpModal: document.getElementById('helpModal'),
  showHelpLink: document.getElementById('showHelp'),
  closeModalButton: document.querySelector('.close')
};

// Настройки по умолчанию
const defaultSettings = {
  apiUrl: 'http://localhost/api',
  enableNotifications: true,
  enableStatusMonitoring: true,
  debugMode: false
};

/**
 * Загрузка настроек из chrome.storage
 */
async function loadSettings() {
  try {
    const settings = await chrome.storage.sync.get(defaultSettings);
    
    // Применяем настройки к элементам формы
    elements.apiUrl.value = settings.apiUrl;
    elements.enableNotifications.checked = settings.enableNotifications;
    elements.enableStatusMonitoring.checked = settings.enableStatusMonitoring;
    elements.debugMode.checked = settings.debugMode;
    
    console.log('Настройки загружены:', settings);
  } catch (error) {
    console.error('Ошибка при загрузке настроек:', error);
    showStatus('Ошибка при загрузке настроек', 'error');
  }
}

/**
 * Сохранение настроек в chrome.storage
 */
async function saveSettings() {
  try {
    // Валидация URL
    const apiUrl = elements.apiUrl.value.trim();
    if (!apiUrl) {
      showStatus('Введите URL API сервера', 'error');
      return;
    }
    
    // Убираем trailing slash
    const cleanApiUrl = apiUrl.replace(/\/$/, '');
    
    const settings = {
      apiUrl: cleanApiUrl,
      enableNotifications: elements.enableNotifications.checked,
      enableStatusMonitoring: elements.enableStatusMonitoring.checked,
      debugMode: elements.debugMode.checked
    };
    
    await chrome.storage.sync.set(settings);
    
    console.log('Настройки сохранены:', settings);
    showStatus('Настройки успешно сохранены', 'success');
    
    // Отправляем сообщение background script о изменении настроек
    chrome.runtime.sendMessage({ 
      action: 'settingsUpdated', 
      settings: settings 
    });
    
  } catch (error) {
    console.error('Ошибка при сохранении настроек:', error);
    showStatus('Ошибка при сохранении настроек', 'error');
  }
}

/**
 * Сброс настроек к значениям по умолчанию
 */
async function resetSettings() {
  if (confirm('Вы уверены, что хотите сбросить все настройки?')) {
    try {
      await chrome.storage.sync.clear();
      await chrome.storage.sync.set(defaultSettings);
      
      // Перезагружаем форму
      await loadSettings();
      
      showStatus('Настройки сброшены к значениям по умолчанию', 'success');
    } catch (error) {
      console.error('Ошибка при сбросе настроек:', error);
      showStatus('Ошибка при сбросе настроек', 'error');
    }
  }
}

/**
 * Проверка подключения к API серверу
 */
async function testConnection() {
  const apiUrl = elements.apiUrl.value.trim();
  
  if (!apiUrl) {
    showTestResult('Введите URL API сервера', 'error');
    return;
  }
  
  elements.testButton.disabled = true;
  elements.testButton.textContent = 'Проверка...';
  showTestResult('Проверка подключения...', 'info');
  
  try {
    // Пробуем подключиться к /health endpoint
    const healthUrl = `${apiUrl.replace(/\/$/, '')}/health`;
    const response = await fetch(healthUrl, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache'
    });
    
    if (response.ok) {
      const data = await response.json();
      showTestResult(
        `✅ Подключение успешно! Сервер доступен. ${data.celery_connected ? 'Celery подключен.' : 'Celery не подключен.'}`,
        'success'
      );
    } else {
      // Если /health недоступен, пробуем базовый URL
      const baseResponse = await fetch(apiUrl, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache'
      });
      
      if (baseResponse.ok) {
        showTestResult('✅ Сервер доступен (endpoint /health не найден)', 'warning');
      } else {
        showTestResult(`❌ Ошибка подключения: HTTP ${response.status}`, 'error');
      }
    }
    
  } catch (error) {
    console.error('Ошибка при проверке подключения:', error);
    showTestResult(
      `❌ Не удалось подключиться к серверу. Проверьте URL и убедитесь, что сервер запущен. ${error.message}`,
      'error'
    );
  } finally {
    elements.testButton.disabled = false;
    elements.testButton.textContent = 'Проверить подключение';
  }
}

/**
 * Показать результат теста подключения
 */
function showTestResult(message, type) {
  elements.testResult.textContent = message;
  elements.testResult.className = `test-result ${type}`;
  elements.testResult.style.display = 'block';
}

/**
 * Показать статусное сообщение
 */
function showStatus(message, type) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.className = `status-message ${type}`;
  elements.statusMessage.style.display = 'block';
  
  // Автоматически скрываем через 3 секунды
  setTimeout(() => {
    elements.statusMessage.style.display = 'none';
  }, 3000);
}

/**
 * Управление модальным окном помощи
 */
function setupModal() {
  // Открытие модального окна
  elements.showHelpLink.addEventListener('click', (e) => {
    e.preventDefault();
    elements.helpModal.style.display = 'block';
  });
  
  // Закрытие по клику на крестик
  elements.closeModalButton.addEventListener('click', () => {
    elements.helpModal.style.display = 'none';
  });
  
  // Закрытие по клику вне модального окна
  window.addEventListener('click', (e) => {
    if (e.target === elements.helpModal) {
      elements.helpModal.style.display = 'none';
    }
  });
}

/**
 * Инициализация
 */
async function init() {
  // Загружаем настройки
  await loadSettings();
  
  // Обработчики событий
  elements.saveButton.addEventListener('click', saveSettings);
  elements.resetButton.addEventListener('click', resetSettings);
  elements.testButton.addEventListener('click', testConnection);
  
  // Enter в поле URL сохраняет настройки
  elements.apiUrl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveSettings();
    }
  });
  
  // Настройка модального окна
  setupModal();
  
  // Автосохранение при изменении чекбоксов
  [elements.enableNotifications, elements.enableStatusMonitoring, elements.debugMode].forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      // Можно добавить автосохранение или показать индикатор несохраненных изменений
    });
  });
}

// Запускаем инициализацию
init(); 