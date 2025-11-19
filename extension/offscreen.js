// offscreen.js - Handles actual media recording

let mediaRecorder = null;
let recordedChunks = [];
let tabStream = null;
let micStream = null;

// Listen for messages from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen') return;

  if (message.type === 'START_OFFSCREEN_RECORDING') {
    startRecording(message.data);
    sendResponse({ success: true });
  }

  if (message.type === 'STOP_OFFSCREEN_RECORDING') {
    stopRecording();
    sendResponse({ success: true });
  }
});

// Start recording with stream ID
async function startRecording(data) {
  try {
    const { streamId, tabId, tabUrl, tabTitle } = data;

    console.log('[Offscreen] Starting recording for tab:', tabId);

    // Step 1: Get tab stream using the stream ID
    tabStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      },
      video: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId,
          maxWidth: 1920,
          maxHeight: 1080,
          maxFrameRate: 30
        }
      }
    });

    console.log('[Offscreen] Got tab stream:', tabStream);

    // Step 2: Get microphone stream (optional)
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });
      console.log('[Offscreen] Got microphone stream');
    } catch (error) {
      console.warn('[Offscreen] Microphone access denied, recording without mic:', error.message);
    }

    // Step 3: Mix audio streams if both available
    const finalStream = micStream ? mixAudioStreams(tabStream, micStream) : tabStream;

    // Step 4: Start recording
    const options = {
      mimeType: 'video/webm;codecs=vp9,opus',
      videoBitsPerSecond: 2500000 // 2.5 Mbps
    };

    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      console.log('[Offscreen] VP9 not supported, trying webm');
      options.mimeType = 'video/webm';
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.log('[Offscreen] WebM not supported, using default');
        delete options.mimeType;
      }
    }

    mediaRecorder = new MediaRecorder(finalStream, options);

    recordedChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      handleRecordingStop(tabId, tabUrl, tabTitle);
    };

    mediaRecorder.onerror = (event) => {
      console.error('[Offscreen] MediaRecorder error:', event.error);
    };

    mediaRecorder.start(1000); // Collect data every 1 second

    console.log('[Offscreen] Recording started successfully');

  } catch (error) {
    console.error('[Offscreen] Recording failed:', error);
    chrome.runtime.sendMessage({
      type: 'RECORDING_ERROR',
      error: error.message
    });
  }
}

// Mix tab audio + microphone audio
function mixAudioStreams(tabStream, micStream) {
  const audioContext = new AudioContext();
  const destination = audioContext.createMediaStreamDestination();

  // Add tab audio
  const tabAudioSource = audioContext.createMediaStreamSource(tabStream);
  tabAudioSource.connect(destination);

  // Add mic audio
  const micAudioSource = audioContext.createMediaStreamSource(micStream);
  micAudioSource.connect(destination);

  // Combine video from tab + mixed audio
  return new MediaStream([
    ...tabStream.getVideoTracks(),
    ...destination.stream.getAudioTracks()
  ]);
}

// Stop recording
function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }

  // Stop all tracks
  if (tabStream) {
    tabStream.getTracks().forEach(track => track.stop());
  }
  if (micStream) {
    micStream.getTracks().forEach(track => track.stop());
  }
}

// Handle recording stop
function handleRecordingStop(tabId, tabUrl, tabTitle) {
  console.log('[Offscreen] Recording stopped, assembling blob...');

  const blob = new Blob(recordedChunks, {
    type: 'video/webm'
  });

  const blobUrl = URL.createObjectURL(blob);

  // Extract platform from URL
  const platform = extractPlatform(tabUrl);

  // Send blob back to background
  chrome.runtime.sendMessage({
    type: 'RECORDING_COMPLETE',
    data: {
      blobUrl,
      metadata: {
        platform,
        title: tabTitle,
        duration: calculateDuration(),
        size: blob.size,
        timestamp: Date.now(),
        tabUrl,
        tabId
      }
    }
  });

  console.log('[Offscreen] Recording complete, blob created, sending to background');
}

// Extract platform from URL
function extractPlatform(url) {
  if (url.includes('meet.google.com')) return 'google-meet';
  if (url.includes('zoom.us')) return 'zoom';
  if (url.includes('teams.microsoft.com')) return 'teams';
  return 'unknown';
}

// Calculate recording duration
function calculateDuration() {
  return recordedChunks.length; // Rough estimate in chunks (approximately seconds)
}

console.log('[Offscreen] Offscreen document initialized');
