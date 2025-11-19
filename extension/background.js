console.log('[Background] Service worker initialized');

// Recording state management
let recordingState = {
  isRecording: false,
  tabId: null,
  startTime: null
};

// Listen for messages from popup and offscreen
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Received message:', message.type);

  if (message.type === 'START_CAPTURE') {
    handleStartRecording(message, sendResponse);
    return true; // Keep channel open for async response
  }

  if (message.type === 'STOP_CAPTURE') {
    handleStopRecording(sendResponse);
    return true;
  }

  // Listen for recording complete from offscreen document
  if (message.type === 'RECORDING_COMPLETE') {
    handleRecordingComplete(message.data);
    sendResponse({ success: true });
  }

  if (message.type === 'RECORDING_ERROR') {
    console.error('[Background] Recording error from offscreen:', message.error);
    recordingState.isRecording = false;
    sendResponse({ success: false, error: message.error });
  }
});

// Start recording flow
async function handleStartRecording(message, sendResponse) {
  try {
    const { tabId, title } = message;

    console.log('[Background] Starting recording for tab:', tabId);

    // Check if already recording
    if (recordingState.isRecording && recordingState.tabId === tabId) {
      console.log('[Background] Already recording this tab');
      sendResponse({ success: false, error: 'Already recording this tab' });
      return;
    }

    // Step 1: Get stream ID from tabCapture (✅ ALLOWED in service worker)
    const streamId = await getStreamId(tabId);

    // Step 2: Create offscreen document if not exists
    await setupOffscreenDocument();

    // Step 3: Send stream ID to offscreen document
    chrome.runtime.sendMessage({
      type: 'START_OFFSCREEN_RECORDING',
      target: 'offscreen',
      data: {
        streamId,
        tabId,
        tabUrl: '', // Will be filled by popup
        tabTitle: title || 'Meeting Recording'
      }
    });

    // Update state
    recordingState = {
      isRecording: true,
      tabId,
      startTime: Date.now()
    };

    console.log('[Background] Recording started successfully');
    sendResponse({ success: true, message: 'Recording started' });

  } catch (error) {
    console.error('[Background] Recording start failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Get stream ID using chrome.tabCapture
function getStreamId(tabId) {
  return new Promise((resolve, reject) => {
    console.log('[Background] Getting stream ID for tab:', tabId);

    chrome.tabCapture.getMediaStreamId(
      { targetTabId: tabId },
      (streamId) => {
        if (chrome.runtime.lastError) {
          console.error('[Background] getMediaStreamId error:', chrome.runtime.lastError.message);
          reject(new Error(chrome.runtime.lastError.message));
        } else if (streamId) {
          console.log('[Background] Got stream ID:', streamId);
          resolve(streamId);
        } else {
          reject(new Error('Failed to get stream ID'));
        }
      }
    );
  });
}

// Setup offscreen document
async function setupOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });

  if (existingContexts.length > 0) {
    console.log('[Background] Offscreen document already exists');
    return;
  }

  console.log('[Background] Creating offscreen document...');

  // Create offscreen document
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA'],
    justification: 'Recording meeting audio/video from chrome.tabCapture API'
  });

  console.log('[Background] Offscreen document created');
}

// Stop recording
async function handleStopRecording(sendResponse) {
  try {
    console.log('[Background] Stopping recording...');

    // Send stop message to offscreen document
    chrome.runtime.sendMessage({
      type: 'STOP_OFFSCREEN_RECORDING',
      target: 'offscreen'
    });

    recordingState.isRecording = false;

    console.log('[Background] Stop signal sent');
    sendResponse({ success: true, message: 'Recording stopped and uploading' });

  } catch (error) {
    console.error('[Background] Recording stop failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle recording complete from offscreen
async function handleRecordingComplete(data) {
  const { blobUrl, metadata } = data;

  console.log('[Background] Recording complete received:', metadata);

  try {
    // Convert blob URL to blob
    const response = await fetch(blobUrl);
    const blob = await response.blob();

    console.log('[Background] Blob fetched, size:', blob.size);

    // Upload to backend
    await uploadRecording(blob, metadata);

    // Clean up
    URL.revokeObjectURL(blobUrl);
    await chrome.offscreen.closeDocument();

    recordingState.isRecording = false;

    console.log('[Background] ✅ Recording uploaded successfully');

  } catch (error) {
    console.error('[Background] Upload failed:', error);
  }
}

// Upload recording to backend
async function uploadRecording(blob, metadata) {
  const formData = new FormData();
  formData.append('video', blob, `recording-${Date.now()}.webm`);
  formData.append('title', metadata.title);
  formData.append('platform', metadata.platform);
  formData.append('duration', metadata.duration.toString());
  formData.append('size', metadata.size.toString());

  console.log('[Background] Uploading to backend...');

  const response = await fetch('http://localhost:3000/api/upload', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload failed: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  console.log('[Background] Upload result:', result);

  return result;
}
