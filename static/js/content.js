let isRecording = false;
let actions = [];
let startTime = null;

function generateSelector(element) {
  if (element.id) return `#${element.id}`;
  
  // Try data-testid first (common in modern apps)
  if (element.getAttribute('data-testid')) {
    return `[data-testid="${element.getAttribute('data-testid')}"]`;
  }
  
  // Try aria-label (common for buttons)
  if (element.getAttribute('aria-label')) {
    return `${element.tagName.toLowerCase()}[aria-label="${element.getAttribute('aria-label')}"]`;
  }
  
  // Try title attribute
  if (element.getAttribute('title')) {
    return `${element.tagName.toLowerCase()}[title="${element.getAttribute('title')}"]`;
  }
  
  // Try role attribute
  if (element.getAttribute('role')) {
    return `${element.tagName.toLowerCase()}[role="${element.getAttribute('role')}"]`;
  }
  
  if (element.className) {
    const classes = element.className.split(' ').filter(c => c.trim());
    if (classes.length > 0) {
      return `${element.tagName.toLowerCase()}.${classes.join('.')}`;
    }
  }
  
  let path = [];
  let current = element;
  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      selector = `#${current.id}`;
      path.unshift(selector);
      break;
    }
    
    let nth = 1;
    let sibling = current.previousElementSibling;
    while (sibling) {
      if (sibling.tagName === current.tagName) nth++;
      sibling = sibling.previousElementSibling;
    }
    
    if (nth > 1) selector += `:nth-child(${nth})`;
    path.unshift(selector);
    current = current.parentElement;
  }
  
  return path.join(' > ');
}

function getInputValue(element) {
  if (element.value !== undefined && element.value !== null) {
    return element.value;
  } else if (element.contentEditable === 'true') {
    return element.textContent || element.innerText || '';
  }
  return '';
}

function recordAction(type, data) {
  if (!isRecording) return;
  
  const action = {
    type,
    timestamp: Date.now() - startTime,
    url: window.location.href,
    ...data
  };
  
  actions.push(action);
  
  try {
    chrome.runtime.sendMessage({
      action: 'newAction',
      data: action
    });
  } catch (error) {
    console.log('Could not send message to side panel:', error);
  }
}

let lastClickTime = 0;
let lastClickTarget = null;

document.addEventListener('click', (e) => {
  if (!isRecording) return;
  
  const currentTime = Date.now();
  const timeSinceLastClick = currentTime - lastClickTime;
  
  // Get the actual clickable element (button, link, etc.)
  let clickableElement = e.target;
  while (clickableElement && clickableElement !== document.body) {
    if (clickableElement.tagName === 'BUTTON' || 
        clickableElement.tagName === 'A' || 
        clickableElement.tagName === 'INPUT' ||
        clickableElement.onclick ||
        clickableElement.getAttribute('role') === 'button' ||
        clickableElement.getAttribute('data-testid') ||
        clickableElement.getAttribute('aria-label')) {
      break;
    }
    clickableElement = clickableElement.parentElement;
  }
  
  if (timeSinceLastClick > 100 || clickableElement !== lastClickTarget) {
    recordAction('click', {
      selector: generateSelector(clickableElement),
      x: e.clientX,
      y: e.clientY,
      text: clickableElement.textContent?.trim() || ''
    });
    
    lastClickTime = currentTime;
    lastClickTarget = clickableElement;
  }
});

let typingTimeout = null;
let currentTypingElement = null;
let currentTypingAction = null;

document.addEventListener('input', (e) => {
  if (!isRecording) return;
  
  const inputValue = getInputValue(e.target);
  
  if (inputValue && inputValue.trim()) {
    currentTypingElement = e.target;
    
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    
    if (!currentTypingAction || currentTypingAction.selector !== generateSelector(e.target)) {
      currentTypingAction = {
        type: 'type',
        timestamp: Date.now() - startTime,
        url: window.location.href,
        selector: generateSelector(e.target),
        value: inputValue,
        inputType: e.target.type || 'text'
      };
      actions.push(currentTypingAction);
      
      try {
        chrome.runtime.sendMessage({
          action: 'newAction',
          data: currentTypingAction
        });
      } catch (error) {
        console.log('Could not send message to side panel:', error);
      }
    } else {
      currentTypingAction.value = inputValue;
      currentTypingAction.timestamp = Date.now() - startTime;
      
      const actionIndex = actions.findIndex(action => action === currentTypingAction);
      if (actionIndex !== -1) {
        try {
          chrome.runtime.sendMessage({
            action: 'updateAction',
            data: currentTypingAction,
            index: actionIndex
          });
        } catch (error) {
          console.log('Could not send updated action to side panel:', error);
        }
      }
    }
    
    typingTimeout = setTimeout(() => {
      if (currentTypingElement === e.target) {
        currentTypingAction = null;
      }
    }, 3000);
  }
});

document.addEventListener('keydown', (e) => {
  if (!isRecording) return;
  
  if (e.key === 'Enter') {
    if (typingTimeout) {
      clearTimeout(typingTimeout);
      typingTimeout = null;
    }
    
    const inputValue = getInputValue(e.target);
    
    if (inputValue && inputValue.trim()) {
      if (currentTypingAction && currentTypingAction.selector === generateSelector(e.target)) {
        currentTypingAction.value = inputValue;
        currentTypingAction.timestamp = Date.now() - startTime;
        
        const actionIndex = actions.findIndex(action => action === currentTypingAction);
        if (actionIndex !== -1) {
          try {
            chrome.runtime.sendMessage({
              action: 'updateAction',
              data: currentTypingAction,
              index: actionIndex
            });
          } catch (error) {
            console.log('Could not send final action to side panel:', error);
          }
        }
      } else {
        recordAction('type', {
          selector: generateSelector(e.target),
          value: inputValue,
          inputType: e.target.type || 'text'
        });
      }
    }
    
    recordAction('keypress', {
      selector: generateSelector(e.target),
      key: 'Enter',
      inputType: e.target.type || 'text'
    });
    
    currentTypingAction = null;
    currentTypingElement = null;
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startRecording') {
    isRecording = true;
    startTime = Date.now();
    actions = [];
    currentTypingElement = null;
    currentTypingAction = null;
    if (typingTimeout) {
      clearTimeout(typingTimeout);
      typingTimeout = null;
    }
    sendResponse({success: true});
  } else if (request.action === 'stopRecording') {
    isRecording = false;
    if (typingTimeout) {
      clearTimeout(typingTimeout);
      typingTimeout = null;
    }
    sendResponse({success: true, actions: actions});
  } else if (request.action === 'getActions') {
    sendResponse({actions: actions});
  }
}); 