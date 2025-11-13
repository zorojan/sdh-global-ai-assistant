import fs from 'fs';
import os from 'os';
import path from 'path';
import { supabase } from '../../database/supabase';

const tryRequire = (name: string) => {
  try { return require(name); } catch (e) { return null; }
};

async function processFallbackAudio(session: any, audioBase64: string, contentType?: string) {
  try {
    if (!audioBase64) return;

    // Only proceed if we have an OpenAI API key for STT/TTS; otherwise we bail (server already sends text fallback)
    const openaiKeySetting = await supabase.from('settings').select('value').eq('key', 'openai_api_key').single();
    const openaiKey = openaiKeySetting?.data?.value || process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      console.log('fallbackHandler: no OPENAI_API_KEY configured; skipping audio->STT/TTS fallback');
      return;
    }

    const OpenAI = tryRequire('openai');
    if (!OpenAI) {
      console.log('fallbackHandler: openai package not available');
      return;
    }

    const client = OpenAI.OpenAI ? new OpenAI.OpenAI({ apiKey: openaiKey }) : new OpenAI({ apiKey: openaiKey });

    // Write audio to temp file
    const ext = (contentType && contentType.includes('ogg')) ? '.ogg' : (contentType && contentType.includes('webm') ? '.webm' : '.wav');
    const tmpPath = path.join(os.tmpdir(), `fallback_${Date.now()}${ext}`);
    fs.writeFileSync(tmpPath, Buffer.from(audioBase64, 'base64'));

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
      console.warn('fallbackHandler: transcription failed', err && err.message ? err.message : err);
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
      console.warn('fallbackHandler: generation failed', err && err.message ? err.message : err);
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
        try { if (session && session.onMessageCallback) session.onMessageCallback(replyText, Buffer.from(audioBase64Out, 'base64')); } catch (e) {}
        try { fs.unlinkSync(outPath); } catch (e) {}
      } else {
        // No TTS available; send text only
        try { if (session && session.onMessageCallback) session.onMessageCallback(replyText); } catch (e) {}
      }
    } catch (err: any) {
      console.warn('fallbackHandler: TTS failed', err && err.message ? err.message : err);
      try { if (session && session.onMessageCallback) session.onMessageCallback(replyText); } catch (e) {}
    }

    // Cleanup temp audio file
    try { fs.unlinkSync(tmpPath); } catch (e) {}

  } catch (err) {
    console.error('fallbackHandler: unexpected error', err);
  }
}

export { processFallbackAudio };
