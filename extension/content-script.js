console.log('[MeetRec] Content script loaded on:', window.location.href);

// Configuration
const API_BASE_URL = 'https://meet-rec-extension-admin-panel.vercel.app';

// State
let isRecording = false;
let startTime = null;
let mediaRecorder = null;
let recordingStream = null;

// AI/Chat State
let isChatOpen = false;
let assemblySocket = null;
let audioContext = null;
let scriptProcessor = null;
let audioInput = null;
let transcriptText = '';
let chatMessages = [];

// Create floating bar
function createFloatingBar() {
  console.log('[MeetRec] Creating floating bar');

  // Remove if exists
  const existing = document.getElementById('meetrec-floating-bar');
  if (existing) {
    existing.remove();
  }

  // Create bar
  const bar = document.createElement('div');
  bar.id = 'meetrec-floating-bar';

  // Styles
  bar.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 999999;
    background: rgba(20, 20, 20, 0.95);
    backdrop-filter: blur(10px);
    color: white;
    padding: 12px 16px;
    border-radius: 12px;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.1);
    cursor: grab;
    user-select: none;
    min-width: 320px;
    display: flex;
    align-items: center;
    gap: 12px;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  `;

  // Add CSS
  const style = document.createElement('style');
  style.textContent = `
    @keyframes recordingPulse {
      0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
      70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
      100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
    }
    .recording-active {
      border: 1px solid rgba(239, 68, 68, 0.5) !important;
    }
    .recording-dot {
      width: 8px;
      height: 8px;
      background-color: #ef4444;
      border-radius: 50%;
      display: inline-block;
      margin-right: 6px;
      animation: recordingPulse 2s infinite;
    }
    .meetrec-btn {
      transition: all 0.2s ease;
    }
    .meetrec-btn:hover {
      transform: translateY(-1px);
      filter: brightness(1.1);
    }
    .meetrec-btn:active {
      transform: translateY(0);
    }
    /* Chat Panel Styles */
    #meetrec-chat-panel {
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 10px;
      width: 320px;
      height: 400px;
      background: rgba(20, 20, 20, 0.98);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      display: none;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    }
    #meetrec-chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: 13px;
    }
    .chat-message {
      padding: 8px 12px;
      border-radius: 8px;
      max-width: 85%;
      word-wrap: break-word;
    }
    .chat-message.user {
      background: rgba(255, 255, 255, 0.1);
      align-self: flex-end;
    }
    .chat-message.bot {
      background: rgba(59, 130, 246, 0.2);
      align-self: flex-start;
      border: 1px solid rgba(59, 130, 246, 0.3);
    }
    .chat-message.system {
      font-size: 11px;
      color: #a1a1aa;
      align-self: center;
      text-align: center;
      background: transparent;
    }
    #meetrec-chat-input-area {
      padding: 10px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      gap: 8px;
    }
    #meetrec-chat-input {
      flex: 1;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      color: white;
      padding: 6px 10px;
      font-size: 13px;
      outline: none;
    }
    #meetrec-chat-input:focus {
      border-color: rgba(255, 255, 255, 0.3);
    }
  `;
  document.head.appendChild(style);

  bar.innerHTML = `
    <div style="display: flex; align-items: center; color: #a1a1aa;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
    </div>
    
    <div style="flex: 1; display: flex; flex-direction: column; gap: 2px;">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div style="font-weight: 600; font-size: 13px; color: #fff; letter-spacing: 0.5px;">MeetRec</div>
        <div id="meetrec-timer" style="font-family: 'JetBrains Mono', monospace; font-size: 13px; color: #e4e4e7; font-variant-numeric: tabular-nums;">00:00:00</div>
      </div>
      <div id="meetrec-status" style="font-size: 11px; color: #a1a1aa;">Ready to record</div>
    </div>

    <div style="display: flex; gap: 8px; align-items: center;">
      <button id="meetrec-chat-toggle" class="meetrec-btn" style="
        background: rgba(255,255,255,0.1);
        border: none;
        color: #fff;
        padding: 6px;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      " title="Toggle AI Assistant">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
      </button>

      <button id="meetrec-start" class="meetrec-btn" style="
        background: #fff; 
        color: #000; 
        border: none; 
        padding: 6px 12px; 
        border-radius: 6px; 
        font-weight: 600; 
        font-size: 12px; 
        cursor: pointer; 
        display: flex; 
        align-items: center; 
        gap: 4px;
      ">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        Start
      </button>
      
      <button id="meetrec-stop" class="meetrec-btn" style="
        background: #ef4444; 
        color: white; 
        border: none; 
        padding: 6px 12px; 
        border-radius: 6px; 
        font-weight: 600; 
        font-size: 12px; 
        cursor: pointer; 
        display: none;
        align-items: center;
        gap: 4px;
      ">
        <div style="width: 8px; height: 8px; background: white; border-radius: 2px;"></div>
        Stop
      </button>

      <button id="meetrec-close" class="meetrec-btn" style="
        background: rgba(255,255,255,0.1); 
        border: none; 
        color: #a1a1aa; 
        cursor: pointer; 
        width: 24px; 
        height: 24px; 
        border-radius: 6px; 
        display: flex; 
        align-items: center; 
        justify-content: center;
      ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>

    <!-- Chat Panel -->
    <div id="meetrec-chat-panel">
      <div style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: 600; font-size: 13px; display: flex; justify-content: space-between; align-items: center;">
        <span>Tellis AI Assistant</span>
        <span style="font-size: 10px; color: #a1a1aa; font-weight: normal;">MiniMax-M2</span>
      </div>
      <div id="meetrec-chat-messages">
        <div class="chat-message system">Say "Tellis note this..." to take notes.</div>
      </div>
      <div id="meetrec-chat-input-area">
        <input type="text" id="meetrec-chat-input" placeholder="Ask Tellis..." />
      </div>
    </div>
  `;

  document.body.appendChild(bar);
  console.log('[MeetRec] Floating bar created');

  // Setup events
  setupEvents(bar);
  setupDrag(bar);
}

function setupEvents(bar) {
  const startBtn = bar.querySelector('#meetrec-start');
  const stopBtn = bar.querySelector('#meetrec-stop');
  const closeBtn = bar.querySelector('#meetrec-close');
  const chatToggleBtn = bar.querySelector('#meetrec-chat-toggle');
  const chatInput = bar.querySelector('#meetrec-chat-input');

  startBtn.addEventListener('click', startRecording);
  stopBtn.addEventListener('click', stopRecording);
  closeBtn.addEventListener('click', () => bar.remove());

  chatToggleBtn.addEventListener('click', () => {
    const panel = bar.querySelector('#meetrec-chat-panel');
    isChatOpen = !isChatOpen;
    panel.style.display = isChatOpen ? 'flex' : 'none';
    if (isChatOpen) {
      chatInput.focus();
    }
  });

  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && chatInput.value.trim()) {
      sendUserMessage(chatInput.value.trim());
      chatInput.value = '';
    }
  });
}

function setupDrag(bar) {
  let isDragging = false;
  let currentX = 0, currentY = 0;
  let initialX, initialY;
  let xOffset = 0, yOffset = 0;

  bar.addEventListener('mousedown', dragStart);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', dragEnd);

  function dragStart(e) {
    // Ignore if clicking buttons or inputs
    if (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.tagName === 'INPUT') return;
    // Ignore chat panel interaction
    if (e.target.closest('#meetrec-chat-panel')) return;

    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;

    if (e.target === bar || bar.contains(e.target)) {
      isDragging = true;
      bar.style.cursor = 'grabbing';
    }
  }

  function drag(e) {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      xOffset = currentX;
      yOffset = currentY;
      setTranslate(currentX, currentY, bar);
    }
  }

  function setTranslate(xPos, yPos, el) {
    el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
  }

  function dragEnd(e) {
    initialX = currentX;
    initialY = currentY;
    isDragging = false;
    bar.style.cursor = 'grab';
  }
}

// --- Chat Logic ---

function addChatMessage(role, text) {
  const container = document.getElementById('meetrec-chat-messages');
  if (!container) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-message ${role}`;
  msgDiv.textContent = text;
  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;

  chatMessages.push({ role: role === 'user' ? 'user' : 'assistant', content: text });
}

async function sendUserMessage(text) {
  addChatMessage('user', text);

  // Prepare context from transcript
  const context = `Current Meeting Transcript:\n${transcriptText.slice(-2000)}\n\nUser Query: ${text}`;

  await callAI(context);
}

async function callAI(prompt) {
  try {
    // Add temporary loading message
    const container = document.getElementById('meetrec-chat-messages');
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'chat-message bot';
    loadingDiv.textContent = '...';
    container.appendChild(loadingDiv);

    const messages = [
      { role: 'system', content: 'You are Tellis, an AI meeting assistant. Use the provided transcript to answer questions or take notes. Be concise.' },
      ...chatMessages.filter(m => m.role !== 'system'), // Send history
      { role: 'user', content: prompt }
    ];

    // Use background script to fetch to avoid Mixed Content / CORS issues
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'CHAT_REQUEST', messages }, (res) => {
        if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
        if (!res.success) return reject(new Error(res.error));
        resolve(res.data);
      });
    });

    // Handle response (currently full text, not streaming)
    loadingDiv.textContent = response;
    container.scrollTop = container.scrollHeight;

    // Update history
    chatMessages.push({ role: 'assistant', content: response });

  } catch (error) {
    console.error('AI Error:', error);
    addChatMessage('system', 'Error: ' + error.message);
  }
}

// --- Audio & Transcription Logic ---

async function setupTranscription(stream) {
  try {
    // Get API key from backend instead of token
    const apiKeyData = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'FETCH_ASSEMBLYAI_KEY' }, (res) => {
        if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
        if (!res.success) return reject(new Error(res.error));
        resolve(res.data);
      });
    });

    const { apiKey } = apiKeyData;
    if (!apiKey) throw new Error('No API key received');

    // Connect WebSocket with API key (Universal Streaming)
    assemblySocket = new WebSocket(`wss://streaming.assemblyai.com/v3/ws?api_key=${apiKey}&sample_rate=16000`);

    assemblySocket.onopen = () => {
      console.log('[MeetRec] AssemblyAI Connected');
      addChatMessage('system', 'Tellis is listening...');
    };

    assemblySocket.onmessage = (message) => {
      const res = JSON.parse(message.data);
      if (res.message_type === 'FinalTranscript') {
        const text = res.text;
        if (text) {
          transcriptText += text + ' ';
          console.log('Transcript:', text);
          checkForCommands(text);
        }
      }
    };

    assemblySocket.onerror = (err) => {
      console.error('AssemblyAI Error:', err);
    };

    // 3. Setup Audio Processing
    audioContext = new AudioContext({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(stream);
    scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);

    source.connect(scriptProcessor);
    scriptProcessor.connect(audioContext.destination);

    scriptProcessor.onaudioprocess = (e) => {
      if (assemblySocket && assemblySocket.readyState === WebSocket.OPEN) {
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32 to Int16
        const buffer = new ArrayBuffer(inputData.length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true); // Little endian
        }
        // Send base64
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        assemblySocket.send(JSON.stringify({ audio_data: base64Data }));
      }
    };

  } catch (error) {
    console.error('Transcription Setup Error:', error);
    addChatMessage('system', 'Transcription failed: ' + error.message);
  }
}

function checkForCommands(text) {
  const lower = text.toLowerCase();
  // Command: "Tellis note this" or "Tellis note that"
  if (lower.includes('tellis') && (lower.includes('note') || lower.includes('summary') || lower.includes('summarize'))) {
    addChatMessage('system', 'Command detected: ' + text);
    callAI(`The user just said: "${text}". Please execute this command based on the transcript.`);
  }
}

function stopTranscription() {
  if (assemblySocket) {
    assemblySocket.close();
    assemblySocket = null;
  }
  if (scriptProcessor) {
    scriptProcessor.disconnect();
    scriptProcessor = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
}

// --- Recording Logic ---

async function startRecording() {
  console.log('[MeetRec] Start recording clicked');
  updateStatus('Select tab to record...', 'preparing');

  try {
    // Use getDisplayMedia to capture screen/tab
    recordingStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: 'browser', // Prefer browser tab
      },
      audio: {
        suppressLocalAudioPlayback: false,
      },
      preferCurrentTab: true // Try to suggest current tab
    });

    // Handle user clicking "Stop sharing" in browser UI
    recordingStream.getVideoTracks()[0].onended = () => {
      stopRecording();
    };

    // Initialize upload in background
    chrome.runtime.sendMessage({ type: 'INIT_UPLOAD' });

    // Start Transcription
    setupTranscription(recordingStream);

    // Create MediaRecorder
    const options = {
      mimeType: 'video/webm;codecs=vp8',
      videoBitsPerSecond: 2500000 // 2.5 Mbps
    };

    mediaRecorder = new MediaRecorder(recordingStream, options);

    mediaRecorder.ondataavailable = async (event) => {
      if (event.data.size > 0) {
        const buffer = await event.data.arrayBuffer();
        try {
          const data = Array.from(new Uint8Array(buffer));
          chrome.runtime.sendMessage({
            type: 'UPLOAD_CHUNK',
            data: data
          });
        } catch (e) {
          console.error('Error sending chunk:', e);
        }
      }
    };

    mediaRecorder.onstop = () => {
      console.log('[MeetRec] MediaRecorder stopped');
      chrome.runtime.sendMessage({ type: 'FINISH_UPLOAD' });
    };

    // Start recording
    mediaRecorder.start(1000); // 1 second chunks

    // Update UI
    isRecording = true;
    startTime = Date.now();
    updateStatus('Recording...', 'recording');

    const startBtn = document.querySelector('#meetrec-start');
    const stopBtn = document.querySelector('#meetrec-stop');
    if (startBtn) startBtn.style.display = 'none';
    if (stopBtn) stopBtn.style.display = 'flex';

    startTimer();

  } catch (error) {
    console.error('[MeetRec] Error starting recording:', error);
    updateStatus('Error: ' + error.message, 'error');
  }
}

function stopRecording() {
  console.log('[MeetRec] Stop recording clicked');

  if (!isRecording) return;

  updateStatus('Stopping...', 'preparing');

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }

  stopTranscription();

  if (recordingStream) {
    recordingStream.getTracks().forEach(track => track.stop());
  }

  isRecording = false;
  stopTimer();

  const startBtn = document.querySelector('#meetrec-start');
  const stopBtn = document.querySelector('#meetrec-stop');
  if (startBtn) startBtn.style.display = 'flex';
  if (stopBtn) stopBtn.style.display = 'none';

  updateStatus('Uploading...', 'uploading');
}

function updateStatus(text, type) {
  const statusEl = document.getElementById('meetrec-status');
  if (statusEl) {
    statusEl.textContent = text;

    // Remove any existing animation classes
    statusEl.classList.remove('recording-pulse');

    if (type === 'recording') {
      statusEl.style.color = '#ff0000';
      // Add pulse animation for recording
      statusEl.classList.add('recording-pulse');
    } else if (type === 'uploading') {
      statusEl.style.color = '#ffff00';
    } else if (type === 'complete') {
      statusEl.style.color = '#10b981';
    } else if (type === 'error') {
      statusEl.style.color = '#ff6b6b';
    } else {
      statusEl.style.color = '#a1a1aa';
    }
  }
}

let timerInterval = null;

function startTimer() {
  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimer() {
  if (!startTime) return;

  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const timerEl = document.getElementById('meetrec-timer');
  if (timerEl) {
    timerEl.textContent = formatTime(elapsed);
  }
}

function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[MeetRec] Message from background:', message.type);

  if (message.type === 'RECORDING_COMPLETE') {
    updateStatus('Upload Complete!', 'complete');
    // Reset to ready after 3 seconds
    setTimeout(() => {
      if (!isRecording) {
        updateStatus('Ready to record', 'ready');
      }
    }, 3000);
  }

  if (message.type === 'RECORDING_ERROR') {
    updateStatus('Error: ' + message.error, 'error');
    isRecording = false;
    const startBtn = document.querySelector('#meetrec-start');
    const stopBtn = document.querySelector('#meetrec-stop');
    if (startBtn) startBtn.style.display = 'flex';
    if (stopBtn) stopBtn.style.display = 'none';
    stopTimer();
  }
});

// Create bar when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createFloatingBar);
} else {
  createFloatingBar();
}
