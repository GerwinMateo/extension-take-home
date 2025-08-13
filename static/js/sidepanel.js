let recordedActions = [];
let startTime = null;
let durationInterval = null;

document.addEventListener('DOMContentLoaded', function() {
  const recordBtn = document.getElementById('recordBtn');
  const stopBtn = document.getElementById('stopBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const clearBtn = document.getElementById('clearBtn');
  const status = document.getElementById('status');
  const actionCount = document.getElementById('actionCount');
  const duration = document.getElementById('duration');
  const actionsList = document.getElementById('actionsList');

  recordBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      const response = await chrome.tabs.sendMessage(tab.id, {action: 'startRecording'});
      
      if (response.success) {
        startRecording();
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      status.textContent = 'Error: Please refresh the page';
    }
  });

  stopBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      const response = await chrome.tabs.sendMessage(tab.id, {action: 'stopRecording'});
      
      if (response.success) {
        recordedActions = response.actions || [];
        stopRecording();
        updateActionsList();
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      status.textContent = 'Error stopping recording';
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (recordedActions.length === 0) {
      alert('No actions to download');
      return;
    }

    const traceData = {
      metadata: {
        recordedAt: new Date().toISOString(),
        totalActions: recordedActions.length,
        userAgent: navigator.userAgent
      },
      actions: recordedActions
    };

    const blob = new Blob([JSON.stringify(traceData, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    chrome.downloads.download({
      url: url,
      filename: `action-trace-${timestamp}.json`,
      saveAs: true
    });
  });

  clearBtn.addEventListener('click', () => {
    recordedActions = [];
    updateActionsList();
    updateStats();
  });

  function startRecording() {
    recordBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    downloadBtn.style.display = 'none';
    status.textContent = 'Recording...';
    status.className = 'status recording';
    
    startTime = Date.now();
    startDurationTimer();
    
    // Listen for new actions
    chrome.runtime.onMessage.addListener(handleNewAction);
  }

  function stopRecording() {
    recordBtn.style.display = 'block';
    stopBtn.style.display = 'none';
    downloadBtn.style.display = 'block';
    status.textContent = 'Recording stopped';
    status.className = 'status stopped';
    
    stopDurationTimer();
    
    // Remove listener
    chrome.runtime.onMessage.removeListener(handleNewAction);
  }

  function handleNewAction(request, sender, sendResponse) {
    if (request.action === 'newAction') {
      const action = request.data;
      
      if (action && action.type && action.timestamp !== undefined) {
        const cleanAction = {
          type: action.type,
          timestamp: action.timestamp,
          url: action.url || window.location.href,
          selector: action.selector || null,
          x: action.x,
          y: action.y,
          text: action.text || null,
          value: action.value || null,
          inputType: action.inputType || null
        };
        
        Object.keys(cleanAction).forEach(key => {
          if (cleanAction[key] === undefined) {
            delete cleanAction[key];
          }
        });
        
        recordedActions.push(cleanAction);
        updateActionsList();
        updateStats();
      }
    } else if (request.action === 'updateAction') {
      const action = request.data;
      const index = request.index;
      
      if (action && index !== undefined && recordedActions[index]) {
        const cleanAction = {
          type: action.type,
          timestamp: action.timestamp,
          url: action.url || window.location.href,
          selector: action.selector || null,
          x: action.x,
          y: action.y,
          text: action.text || null,
          value: action.value || null,
          inputType: action.inputType || null
        };
        
        Object.keys(cleanAction).forEach(key => {
          if (cleanAction[key] === undefined) {
            delete cleanAction[key];
          }
        });
        
        recordedActions[index] = cleanAction;
        updateActionsList();
        updateStats();
      }
    }
  }

  function updateActionsList() {
    if (recordedActions.length === 0) {
      actionsList.innerHTML = '<div class="no-actions">No actions recorded yet</div>';
      return;
    }

    actionsList.innerHTML = recordedActions.map((action, index) => {
      const time = formatTime(action.timestamp);
      const details = getActionDetails(action);
      
      return `
        <div class="action-item">
          <div class="action-header">
            <span class="action-type ${action.type}">${action.type}</span>
            <span class="action-time">${time}</span>
          </div>
          <div class="action-details">${details}</div>
          ${action.selector ? `<div class="action-selector">${action.selector}</div>` : ''}
        </div>
      `;
    }).join('');
  }

  function getActionDetails(action) {
    switch (action.type) {
      case 'click':
        const clickText = action.text ? `"${action.text}"` : 'element';
        return `Clicked on ${clickText}`;
      case 'type':
        const value = action.value || '';
        return `Typed: "${value}"`;
      case 'keypress':
        const key = action.key || '';
        return `Pressed key: ${key}`;
      default:
        return `Action: ${action.type}`;
    }
  }

  function formatTime(timestamp) {
    const seconds = Math.floor(timestamp / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  function updateStats() {
    actionCount.textContent = recordedActions.length;
  }

  function startDurationTimer() {
    durationInterval = setInterval(() => {
      if (startTime) {
        const elapsed = Date.now() - startTime;
        duration.textContent = formatTime(elapsed);
      }
    }, 1000);
  }

  function stopDurationTimer() {
    if (durationInterval) {
      clearInterval(durationInterval);
      durationInterval = null;
    }
  }

  checkCurrentStatus();
});

async function checkCurrentStatus() {
  try {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    const response = await chrome.tabs.sendMessage(tab.id, {action: 'getActions'});
    
    if (response && response.actions) {
      recordedActions = response.actions;
      updateActionsList();
      updateStats();
    }
  } catch (error) {
    console.log('Content script not ready');
  }
} 