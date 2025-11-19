// popup.js - UI only, sends messages to background service worker

const API_URL = 'http://localhost:3004/api/upload';

const statusEl = document.getElementById('status');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const titleInput = document.getElementById('title');
const timerEl = document.getElementById('timer');
const timeDisplay = document.getElementById('timeDisplay');
const progressEl = document.getElementById('progress');
const progressPercent = document.getElementById('progressPercent');
const tabUrlEl = document.getElementById('tabUrl');

let isRecording = false;
let startTime;
let timerInterval;

function updateStatus(message, recording = false) {
  statusEl.textContent = message;
  statusEl.className = `status${recording ? ' recording' : ''}`;
}

function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function startTimer() {
  startTime = Date.now();
  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    timeDisplay.textContent = formatTime(elapsed);
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
}

async function startRecording() {
  try {
    updateStatus('Starting recording...');
    startBtn.disabled = true;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    console.log('[Popup] Starting recording for tab:', tab.id, tab.url);

    // Check if tab is a meeting platform
    const validDomains = ['meet.google.com', 'zoom.us', 'teams.microsoft.com'];
    const url = new URL(tab.url);

    if (!validDomains.some(domain => url.hostname.includes(domain))) {
      updateStatus('⚠️ Please open a meeting page first');
      startBtn.disabled = false;
      return;
    }

    // Send message to background service worker
    const response = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Service worker timeout'));
      }, 10000);

      chrome.runtime.sendMessage(
        {
          type: 'START_CAPTURE',
          tabId: tab.id,
          title: titleInput.value || 'Meeting Recording'
        },
        (response) => {
          clearTimeout(timeout);

          if (chrome.runtime.lastError) {
            reject(new Error('Runtime: ' + chrome.runtime.lastError.message));
            return;
          }

          if (!response) {
            reject(new Error('No response from service worker'));
            return;
          }

          if (response.success) {
            resolve(response);
          } else {
            reject(new Error(response.error || 'Failed to start recording'));
          }
        }
      );
    });

    console.log('[Popup] Recording started:', response);

    updateStatus('🔴 Recording...', true);
    timerEl.style.display = 'block';
    startTimer();
    stopBtn.disabled = false;
    isRecording = true;

  } catch (error) {
    console.error('[Popup] Recording error:', error);

    let errorMessage = error.message;

    if (error.name === 'AbortError' || errorMessage.includes('AbortError') || errorMessage.includes('starting tab capture')) {
      errorMessage = '⚠️ TAB CAPTURE FAILED\n\nTry:\n1. Refresh the page\n2. Grant ALL permissions\n3. Use on Google Meet/Zoom/Teams';
    } else if (errorMessage.includes('NotAllowedError') || errorMessage.includes('permission')) {
      errorMessage = 'Permission denied. Please allow tab recording.';
    } else if (errorMessage.includes('NotSupportedError')) {
      errorMessage = 'This site doesn\'t support recording. Try Google Meet, Zoom, or Teams.';
    } else if (errorMessage.includes('Service worker timeout')) {
      errorMessage = 'Service worker not responding. Reload extension.';
    } else if (errorMessage.includes('No response from service worker')) {
      errorMessage = 'Check service worker console for errors.';
    }

    updateStatus(`Error: ${errorMessage}`);
    startBtn.disabled = false;
    stopBtn.disabled = true;
    timerEl.style.display = 'none';
    isRecording = false;
  }
}

async function stopRecording() {
  try {
    stopBtn.disabled = true;
    updateStatus('Stopping recording...');

    const response = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Stop timeout'));
      }, 10000);

      chrome.runtime.sendMessage(
        { type: 'STOP_CAPTURE' },
        (response) => {
          clearTimeout(timeout);

          if (chrome.runtime.lastError) {
            reject(new Error('Runtime: ' + chrome.runtime.lastError.message));
            return;
          }

          if (!response) {
            reject(new Error('No response from service worker'));
            return;
          }

          if (response.success) {
            resolve(response);
          } else {
            reject(new Error(response.error || 'Failed to stop recording'));
          }
        }
      );
    });

    console.log('[Popup] Recording stopped:', response);

    stopTimer();
    updateStatus('✅ Upload complete!');
    progressEl.style.display = 'none';
    startBtn.disabled = false;
    isRecording = false;

    setTimeout(() => {
      updateStatus('Ready to record');
      titleInput.value = '';
      timerEl.style.display = 'none';
    }, 2000);

  } catch (error) {
    console.error('[Popup] Stop error:', error);
    updateStatus(`Error stopping: ${error.message}`);
    stopBtn.disabled = false;
  }
}

// Load current tab info
async function loadTabInfo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = new URL(tab.url);
    const domain = url.hostname;

    let supportMsg = '✅ Supports recording';
    if (!['meet.google.com', 'zoom.us', 'teams.microsoft.com', 'localhost'].some(d => domain.includes(d))) {
      supportMsg = '⚠️ May not support recording';
    }

    tabUrlEl.textContent = `${domain} ${supportMsg}`;
  } catch (error) {
    tabUrlEl.textContent = 'Unable to get tab info';
  }
}

// Event listeners
startBtn.addEventListener('click', startRecording);
stopBtn.addEventListener('click', stopRecording);

// Initialize
loadTabInfo();
updateStatus('Ready to record');
