console.log('[MeetRec] Background service worker started');

let uploadId = null;
let chunkBuffer = [];
let bufferSize = 0;
let totalUploadedBytes = 0;
let isUploading = false;
let uploadQueue = [];
const CHUNK_SIZE_LIMIT = 5 * 1024 * 1024; // 5MB minimum for Cloudinary chunks

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[MeetRec] Message:', message.type);

  if (message.type === 'INIT_UPLOAD') {
    initUpload();
    sendResponse({ success: true });
  }

  if (message.type === 'UPLOAD_CHUNK') {
    // Data comes as array of numbers (Uint8Array)
    const uint8Array = new Uint8Array(message.data);
    const blob = new Blob([uint8Array], { type: 'video/webm' });
    handleDataAvailable(blob);
    sendResponse({ success: true });
  }

  if (message.type === 'FINISH_UPLOAD') {
    finishUpload(sender.tab.id);
    sendResponse({ success: true });
  }

  return true; // Keep channel open for async response
});

function initUpload() {
  console.log('[MeetRec] Initializing upload...');
  // Reset state
  uploadId = 'meetrec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  chunkBuffer = [];
  bufferSize = 0;
  totalUploadedBytes = 0;
  uploadQueue = [];
  isUploading = false;
}

async function handleDataAvailable(blob) {
  chunkBuffer.push(blob);
  bufferSize += blob.size;

  // If buffer is large enough, upload it
  if (bufferSize >= CHUNK_SIZE_LIMIT) {
    await flushBuffer(false);
  }
}

async function finishUpload(tabId) {
  console.log('[MeetRec] Finishing upload...');
  await flushBuffer(true, tabId);
}

async function flushBuffer(isFinal, tabId) {
  if (chunkBuffer.length === 0 && !isFinal) return;

  const blob = new Blob(chunkBuffer, { type: 'video/webm' });
  chunkBuffer = [];
  bufferSize = 0;

  // Add to upload queue
  uploadQueue.push({ blob, isFinal, tabId });
  processUploadQueue();
}

async function processUploadQueue() {
  if (isUploading || uploadQueue.length === 0) return;

  isUploading = true;
  const { blob, isFinal, tabId } = uploadQueue.shift();

  try {
    console.log(`[MeetRec] Uploading chunk: ${blob.size} bytes (Final: ${isFinal})`);
    const result = await uploadChunkToCloudinary(blob, isFinal);

    totalUploadedBytes += blob.size;

    if (isFinal) {
      console.log('[MeetRec] Upload complete:', result);
      await saveMetadata(result);
      if (tabId) {
        chrome.tabs.sendMessage(tabId, { type: 'RECORDING_COMPLETE' });
      }
    }
  } catch (error) {
    console.error('[MeetRec] Chunk upload failed:', error);
    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        type: 'RECORDING_ERROR',
        error: 'Upload failed: ' + error.message
      });
    }
  } finally {
    isUploading = false;
    processUploadQueue();
  }
}

async function uploadChunkToCloudinary(blob, isFinal) {
  const url = `https://api.cloudinary.com/v1_1/dtuqfmmtw/video/upload`;
  const start = totalUploadedBytes;
  const end = start + blob.size - 1;

  const total = isFinal ? (totalUploadedBytes + blob.size) : '*';
  const contentRange = `bytes ${start}-${end}/${total}`;

  const formData = new FormData();
  formData.append('file', blob);
  formData.append('upload_preset', 'meetrec');
  formData.append('cloud_name', 'dtuqfmmtw');

  const headers = {
    'X-Unique-Upload-Id': uploadId,
    'Content-Range': contentRange
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: formData
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upload failed: ${response.status} - ${text}`);
  }

  return await response.json();
}

async function saveMetadata(result) {
  try {
    const response = await fetch('http://localhost:3003/api/recordings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Meeting Recording ' + new Date().toLocaleString(),
        url: result.secure_url,
        publicId: result.public_id,
        duration: Math.round(result.duration || 0),
        size: result.bytes || 0,
        platform: 'google-meet'
      })
    });

    if (!response.ok) {
      console.error('Metadata save failed but upload succeeded');
    }
  } catch (e) {
    console.error('Metadata save error:', e);
  }
}
