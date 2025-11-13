import fs from 'fs';
import os from 'os';
import path from 'path';
import { supabase } from '../../database/supabase';

// If OpenAI returns repeated 429 quota errors, temporarily disable fallback calls
const OPENAI_FALLBACK_COOLDOWN_MS = Number(process.env.OPENAI_FALLBACK_COOLDOWN_MS) || 60 * 60 * 1000; // 1 hour default
let openaiFallbackDisabledUntil = 0;

function isOpenAIFallbackDisabled() {
  return Date.now() < (openaiFallbackDisabledUntil || 0);
}

// Respect env toggle to completely disable OpenAI fallback behavior
const ENABLE_OPENAI_FALLBACK = process.env.ENABLE_OPENAI_FALLBACK !== 'false';

const tryRequire = (name: string) => {
  try { return require(name); } catch (e) { return null; }
};

async function processFallbackAudio(session: any, audioBase64: string, contentType?: string) {
  try {
    if (!audioBase64) return;
    if (!ENABLE_OPENAI_FALLBACK) {
      console.log('fallbackHandler: OpenAI fallback disabled via ENABLE_OPENAI_FALLBACK=false; skipping processing');
      return;
    }
    if (isOpenAIFallbackDisabled()) {
      console.log('fallbackHandler: OpenAI fallback temporarily disabled due to previous quota errors; skipping processing');
      return;
    }

    // Per-session rate limiting to avoid burning keys on aggressive clients.
    const PER_SESSION_FALLBACK_MAX = Number(process.env.PER_SESSION_FALLBACK_MAX) || 2;
    const PER_SESSION_FALLBACK_WINDOW_MS = Number(process.env.PER_SESSION_FALLBACK_WINDOW_MS) || 60_000;
    const PER_SESSION_FALLBACK_COOLDOWN_MS = Number(process.env.PER_SESSION_FALLBACK_COOLDOWN_MS) || (5 * 60_000);

    // Map<sessionId, {count:number, windowStart:number, disabledUntil:number}>
    if (!(global as any).__perSessionFallbackState) (global as any).__perSessionFallbackState = new Map();
    const perSessionFallbackState: Map<string, any> = (global as any).__perSessionFallbackState;

    const now = Date.now();
    const sid = session && (session.sessionId || session.id || session.sessionID);
    if (sid) {
      let st = perSessionFallbackState.get(sid);
      if (!st) {
        st = { count: 0, windowStart: now, disabledUntil: 0 };
        perSessionFallbackState.set(sid, st);
      }
      if (st.disabledUntil && st.disabledUntil > now) {
        const waitMs = st.disabledUntil - now;
        console.log(`fallbackHandler: session ${sid} fallback disabled until ${new Date(st.disabledUntil).toISOString()}; skipping processing`);
        try {
          if (session && session.onMessageCallback) {
            session.onMessageCallback({ type: 'fallback_disabled', reason: 'rate_limit', waitMs });
            const minutes = Math.ceil(waitMs / 60000);
            session.onMessageCallback(`[FALLBACK PAUSED] Fallback temporarily paused due to rate limiting — try again in ${minutes} minute(s).`);
          }
        } catch (e) {}
        return;
      }
      if (now - st.windowStart > PER_SESSION_FALLBACK_WINDOW_MS) {
        st.windowStart = now;
        st.count = 0;
      }
      if (st.count >= PER_SESSION_FALLBACK_MAX) {
        st.disabledUntil = now + PER_SESSION_FALLBACK_COOLDOWN_MS;
        console.error(`fallbackHandler: session ${sid} exceeded per-session fallback limit; disabling for ${Math.round(PER_SESSION_FALLBACK_COOLDOWN_MS/60000)} minutes`);
        try {
          if (session && session.onMessageCallback) {
            session.onMessageCallback({ type: 'fallback_disabled', reason: 'rate_limit', waitMs: PER_SESSION_FALLBACK_COOLDOWN_MS });
            const minutes = Math.ceil(PER_SESSION_FALLBACK_COOLDOWN_MS / 60000);
            session.onMessageCallback(`[FALLBACK PAUSED] Fallback temporarily paused due to rate limiting — try again in ${minutes} minute(s).`);
          }
        } catch (e) {}
        return;
      }
      // consume one slot
      st.count++;
    }

    // Only proceed if we have an OpenAI API key for STT/TTS; otherwise we bail (server already sends text fallback)
    const openaiKeySetting = await supabase.from('settings').select('value').eq('key', 'openai_api_key').single();
    const openaiKeyFromSettings = openaiKeySetting?.data?.value;
    const openaiKeyFromEnv = process.env.OPENAI_API_KEY;
    const openaiKey = openaiKeyFromSettings || openaiKeyFromEnv;
    if (!openaiKey) {
      console.log('fallbackHandler: no OPENAI_API_KEY configured (settings or env); skipping audio->STT/TTS fallback');
      return;
    }
    // Log where the key was sourced from for diagnostics
    try {
      if (openaiKeyFromSettings) console.log('fallbackHandler: using OpenAI key from settings');
      else if (openaiKeyFromEnv) console.log('fallbackHandler: using OpenAI key from process.env');
    } catch (e) {}

    const OpenAI = tryRequire('openai');
    if (!OpenAI) {
      console.log('fallbackHandler: openai package not available');
      return;
    }

    const client = OpenAI.OpenAI ? new OpenAI.OpenAI({ apiKey: openaiKey }) : new OpenAI({ apiKey: openaiKey });

    // Write audio to temp file. If we received raw PCM (audio/pcm), wrap it into a WAV container
    let ext = '.wav';
    let fileBuffer = Buffer.from(audioBase64, 'base64');
    const isPcm = contentType && contentType.includes('pcm');
    if (contentType && contentType.includes('ogg')) ext = '.ogg';
    else if (contentType && contentType.includes('webm')) ext = '.webm';

    if (isPcm) {
      // parse rate from contentType e.g. audio/pcm;rate=16000
      let sampleRate = 16000;
      try {
        const m = /rate=(\d+)/.exec(contentType || '');
        if (m && m[1]) sampleRate = parseInt(m[1], 10) || sampleRate;
      } catch (e) {}

      // Build a minimal WAV header for 16-bit PCM mono
      const numChannels = 1;
      const bitsPerSample = 16;
      const byteRate = sampleRate * numChannels * bitsPerSample / 8;
      const blockAlign = numChannels * bitsPerSample / 8;
      const dataSize = fileBuffer.length;

      const header = Buffer.alloc(44);
      // ChunkID 'RIFF'
      header.write('RIFF', 0);
      // ChunkSize 36 + SubChunk2Size
      header.writeUInt32LE(36 + dataSize, 4);
      // Format 'WAVE'
      header.write('WAVE', 8);
      // Subchunk1ID 'fmt '
      header.write('fmt ', 12);
      // Subchunk1Size (16 for PCM)
      header.writeUInt32LE(16, 16);
      // AudioFormat (1 = PCM)
      header.writeUInt16LE(1, 20);
      // NumChannels
      header.writeUInt16LE(numChannels, 22);
      // SampleRate
      header.writeUInt32LE(sampleRate, 24);
      // ByteRate
      header.writeUInt32LE(byteRate, 28);
      // BlockAlign
      header.writeUInt16LE(blockAlign, 32);
      // BitsPerSample
      header.writeUInt16LE(bitsPerSample, 34);
      // Subchunk2ID 'data'
      header.write('data', 36);
      // Subchunk2Size
      header.writeUInt32LE(dataSize, 40);

      fileBuffer = Buffer.concat([header, fileBuffer]);
      ext = '.wav';
    }

    const tmpPath = path.join(os.tmpdir(), `fallback_${Date.now()}${ext}`);
    fs.writeFileSync(tmpPath, fileBuffer);

    let transcript = '';
    try {
      // Try Whisper-style transcription via OpenAI SDK
      if (client.audio && typeof client.audio.transcriptions?.create === 'function') {
        const r = await client.audio.transcriptions.create({ file: fs.createReadStream(tmpPath), model: 'whisper-1' });
        transcript = r && (r.text || r.transcript || r.data?.text) || '';
      } else if (client.transcriptions && typeof client.transcriptions.create === 'function') {
        const r = await client.transcriptions.create({ file: fs.createReadStream(tmpPath), model: 'whisper-1' });
        transcript = r && (r.text || r.transcript || r.data?.text) || '';
      } else {
        console.warn('fallbackHandler: no known transcription method on OpenAI client');
      }
    } catch (err: any) {
      const msg = err && (err.message || err.toString && err.toString());
      const is429 = (err && ((err.status === 429) || (err.statusCode === 429))) || (msg && (msg.includes('429') || /quota/i.test(msg)));
      if (is429) {
        const until = Date.now() + OPENAI_FALLBACK_COOLDOWN_MS;
        openaiFallbackDisabledUntil = until;
        try {
          const sidLocal = session && (session.sessionId || session.id || session.sessionID);
          if (sidLocal && (global as any).__perSessionFallbackState) {
            const map: Map<string, any> = (global as any).__perSessionFallbackState;
            let st = map.get(sidLocal);
            if (!st) { st = { count: 0, windowStart: Date.now(), disabledUntil: until }; map.set(sidLocal, st); }
            else { st.disabledUntil = until; }
          }
        } catch (e) {}
        console.error(`fallbackHandler: OpenAI transcription returned 429 (quota). Disabling fallback for ${Math.round(OPENAI_FALLBACK_COOLDOWN_MS/60000)} minutes.`);
      } else {
        console.warn('fallbackHandler: transcription failed', msg || err);
      }
    }

    // Build prompt for reply generation
    let prompt = '';
    if (transcript && transcript.trim().length > 0) {
      prompt = `User said: "${transcript}"\n\nRespond briefly and helpfully to the user in the same language.`;
    } else {
      prompt = `User sent an audio message I couldn't transcribe reliably. Please reply politely asking for clarification or short confirmation.`;
    }

    // Generate reply text via OpenAI chat completion (best-effort)
    let replyText = '';
    try {
      if (client.chat && typeof client.chat.completions?.create === 'function') {
        const gen = await client.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 250 });
        replyText = gen && (gen.choices && gen.choices[0] && gen.choices[0].message && gen.choices[0].message.content) || gen?.choices?.[0]?.text || '';
      } else if (client.responses && typeof client.responses.create === 'function') {
        const gen = await client.responses.create({ model: 'gpt-4o-mini', input: prompt, max_output_tokens: 250 });
        replyText = gen && (gen.output && gen.output[0] && gen.output[0].content && gen.output[0].content[0] && gen.output[0].content[0].text) || gen?.output_text || '';
      } else {
        console.warn('fallbackHandler: no known text-generation method on OpenAI client');
      }
    } catch (err: any) {
      const msg = err && (err.message || err.toString && err.toString());
      const is429 = (err && ((err.status === 429) || (err.statusCode === 429))) || (msg && (msg.includes('429') || /quota/i.test(msg)));
      if (is429) {
        const until = Date.now() + OPENAI_FALLBACK_COOLDOWN_MS;
        openaiFallbackDisabledUntil = until;
        try {
          const sidLocal = session && (session.sessionId || session.id || session.sessionID);
          if (sidLocal && (global as any).__perSessionFallbackState) {
            const map: Map<string, any> = (global as any).__perSessionFallbackState;
            let st = map.get(sidLocal);
            if (!st) { st = { count: 0, windowStart: Date.now(), disabledUntil: until }; map.set(sidLocal, st); }
            else { st.disabledUntil = until; }
          }
        } catch (e) {}
        console.error(`fallbackHandler: OpenAI generation returned 429 (quota). Disabling fallback for ${Math.round(OPENAI_FALLBACK_COOLDOWN_MS/60000)} minutes.`);
      } else {
        console.warn('fallbackHandler: generation failed', msg || err);
      }
    }

    if (!replyText || replyText.trim().length === 0) replyText = "I heard your message. Could you please repeat or type it?";

    // Try to synthesize audio using OpenAI TTS (best-effort)
    try {
      if (client.audio && typeof client.audio.speech?.create === 'function') {
        const voice = (await supabase.from('settings').select('value').eq('key','openai_voice').single()).data?.value || process.env.OPENAI_VOICE || 'alloy';
        const outPath = tmpPath + '.mp3';
        const r = await client.audio.speech.create({ model: 'gpt-4o-mini-tts', voice, input: replyText });
        // r is a stream or ArrayBuffer depending on SDK; try to write
        if (r instanceof Buffer) {
          fs.writeFileSync(outPath, r);
        } else if (r.arrayBuffer) {
          const buf = Buffer.from(await r.arrayBuffer());
          fs.writeFileSync(outPath, buf);
        } else if (r.pipe) {
          const ws = fs.createWriteStream(outPath);
          r.pipe(ws);
          await new Promise((res) => ws.on('finish', () => res(undefined)));
        }

        const audioBase64Out = fs.readFileSync(outPath).toString('base64');
        try { if (session && session.onMessageCallback) session.onMessageCallback(replyText, Buffer.from(audioBase64Out, 'base64'), 'audio/mp3'); } catch (e) {}
        try { fs.unlinkSync(outPath); } catch (e) {}
      } else {
        // No TTS available; send text only
        try { if (session && session.onMessageCallback) session.onMessageCallback(replyText); } catch (e) {}
      }
    } catch (err: any) {
      const msg = err && (err.message || err.toString && err.toString());
      const is429 = (err && ((err.status === 429) || (err.statusCode === 429))) || (msg && (msg.includes('429') || /quota/i.test(msg)));
      if (is429) {
        const until = Date.now() + OPENAI_FALLBACK_COOLDOWN_MS;
        openaiFallbackDisabledUntil = until;
        try {
          const sidLocal = session && (session.sessionId || session.id || session.sessionID);
          if (sidLocal && (global as any).__perSessionFallbackState) {
            const map: Map<string, any> = (global as any).__perSessionFallbackState;
            let st = map.get(sidLocal);
            if (!st) { st = { count: 0, windowStart: Date.now(), disabledUntil: until }; map.set(sidLocal, st); }
            else { st.disabledUntil = until; }
          }
        } catch (e) {}
        console.error(`fallbackHandler: OpenAI TTS returned 429 (quota). Disabling fallback for ${Math.round(OPENAI_FALLBACK_COOLDOWN_MS/60000)} minutes.`);
      } else {
        console.warn('fallbackHandler: TTS failed', msg || err);
      }
      try { if (session && session.onMessageCallback) session.onMessageCallback(replyText); } catch (e) {}
    }

    // Cleanup temp audio file
    try { fs.unlinkSync(tmpPath); } catch (e) {}

  } catch (err) {
    console.error('fallbackHandler: unexpected error', err);
  }
}

export { processFallbackAudio };
