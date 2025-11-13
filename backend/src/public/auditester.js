(function(){
  const logEl = document.getElementById('log');
  const sessionInfo = document.getElementById('sessionInfo');
  let current = { sessionId: null, wsUrl: null, ws: null };

  function log(...args) {
    const t = new Date().toISOString();
    logEl.textContent = t + ' ' + args.join(' ') + '\n' + logEl.textContent;
  }

  document.getElementById('create').addEventListener('click', async () => {
    log('Creating session...');
    try {
      const r = await fetch('/api/gemini/live/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const j = await r.json();
      if (!j.success) { log('Create failed', JSON.stringify(j)); return; }
      current.sessionId = j.sessionId;
      current.wsUrl = (new URL(j.wsUrl, window.location.href)).toString();
      sessionInfo.textContent = `Session: ${current.sessionId}`;
      log('Session created:', current.sessionId, 'wsUrl:', current.wsUrl);

      // connect to backend WS
      if (current.ws) try { current.ws.close(); } catch (e) {}
      const wsUrl = `ws://${window.location.host}/?sessionId=${encodeURIComponent(current.sessionId)}`;
      const ws = new WebSocket(wsUrl);
      current.ws = ws;
      ws.onopen = () => log('WS connected to backend');
      ws.onmessage = (ev) => {
        try {
          const m = JSON.parse(ev.data);
          log('WS ->', JSON.stringify(m));
          // If server sends audio bytes, play them (mp3 assumed), otherwise speak text using TTS
          if (m && m.audio && Array.isArray(m.audio) && m.audio.length > 0) {
            try {
              const bytes = new Uint8Array(m.audio);
              const blob = new Blob([bytes.buffer], { type: 'audio/mpeg' });
              const url = URL.createObjectURL(blob);
              const a = new Audio(url);
              a.onended = () => { URL.revokeObjectURL(url); };
              a.play().catch(() => {
                // fallback to TTS if playback fails
                const text = m.text || '';
                const utter = new SpeechSynthesisUtterance(typeof text === 'string' ? text : JSON.stringify(text));
                window.speechSynthesis.cancel();
                window.speechSynthesis.speak(utter);
              });
            } catch (e) {
              // ignore playback errors
            }
          } else if (m && (m.type === 'message' || typeof m === 'string' || m.text)) {
            const text = (typeof m === 'string') ? m : (m.text || m);
            // Ignore processing placeholders sent by the server
            if (typeof text === 'string' && text.startsWith('[PROCESSING]')) {
              log('Server is processing audio — waiting for reply');
              return;
            }
            try {
              const utter = new SpeechSynthesisUtterance(typeof text === 'string' ? text : JSON.stringify(text));
              window.speechSynthesis.cancel();
              window.speechSynthesis.speak(utter);
            } catch (e) {
              // ignore TTS errors
            }
          }
        } catch (e) { log('WS raw ->', ev.data); }
      };
      ws.onclose = () => log('WS closed');
      ws.onerror = (e) => log('WS error', e && e.message ? e.message : e);

    } catch (err) {
      log('Create session error', err && err.message ? err.message : err);
    }
  });

  document.getElementById('sendText').addEventListener('click', async () => {
    const text = document.getElementById('text').value;
    if (!current.sessionId) { log('No session'); return; }
    log('Sending text:', text.slice(0,200));
    try {
      const r = await fetch('/api/gemini/live/send-text', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: current.sessionId, text }) });
      const j = await r.json();
      log('send-text response:', JSON.stringify(j));
    } catch (err) {
      log('send-text error', err && err.message ? err.message : err);
    }
  });

  document.getElementById('cleanup').addEventListener('click', async () => {
    if (!current.sessionId) { log('No session to cleanup'); return; }
    try {
      const r = await fetch('/api/gemini/live/cleanup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: current.sessionId }) });
      const j = await r.json();
      log('cleanup response:', JSON.stringify(j));
      if (current.ws) try { current.ws.close(); } catch (e) {}
      current = { sessionId: null, wsUrl: null, ws: null };
      sessionInfo.textContent = 'No session';
    } catch (err) { log('cleanup error', err && err.message ? err.message : err); }
  });

  // Audio recording support
  const recordBtn = document.createElement('button');
  recordBtn.textContent = 'Record';
  const stopBtn = document.createElement('button');
  stopBtn.textContent = 'Stop';
  stopBtn.disabled = true;
  recordBtn.style.marginLeft = '8px';
  stopBtn.style.marginLeft = '8px';
  document.getElementById('create').parentElement.appendChild(recordBtn);
  document.getElementById('create').parentElement.appendChild(stopBtn);

  let mediaRecorder = null;
  let chunks = [];

  recordBtn.addEventListener('click', async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { log('Media devices not supported'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      chunks = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const arrayBuffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        // convert to base64
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
        }
        const base64 = btoa(binary);

        if (!current.sessionId) { log('No session to send audio'); return; }
        log('Sending recorded audio (' + Math.round(base64.length / 1024) + 'KB)');
        try {
          const r = await fetch('/api/gemini/live/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: current.sessionId, audioBase64: base64, contentType: 'audio/webm' }) });
          const j = await r.json();
          log('send-audio response: ' + JSON.stringify(j));
        } catch (err) { log('send-audio error', err && err.message ? err.message : err); }
      };
      mediaRecorder.start();
      recordBtn.disabled = true; stopBtn.disabled = false; log('Recording...');
    } catch (err) {
      log('getUserMedia error: ' + err.message);
    }
  });

  stopBtn.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      recordBtn.disabled = false; stopBtn.disabled = true; log('Recording stopped');
    }
  });
})();
