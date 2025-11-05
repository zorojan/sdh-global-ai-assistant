import express from 'express';
import { getDatabase } from '../database/init';
import { promisify } from 'util';
import fetch from 'node-fetch';

const router = express.Router();

// OpenAI Realtime API Session endpoint - Server-side SDP proxy
router.post('/session', express.raw({ type: 'application/sdp', limit: '10mb' }), async (req: any, res: express.Response) => {
  try {
    console.log('🎤 OpenAI Realtime API session request received');

    // Get OpenAI API key from database
    const db = getDatabase();
    const get = promisify(db.get.bind(db)) as any;
    
    const apiKeySetting = await get('SELECT value FROM settings WHERE key = ?', ['openai_api_key']) as any;
    
    if (!apiKeySetting || !apiKeySetting.value) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const apiKey = apiKeySetting.value;

    // Get voice and language settings
    const openaiVoiceSetting = await get('SELECT value FROM settings WHERE key = ?', ['openai_voice']) as any;
    const realtimeLanguageSetting = await get('SELECT value FROM settings WHERE key = ?', ['realtime_language']) as any;

    const selectedVoice = openaiVoiceSetting?.value || 'alloy';
    const selectedLanguage = realtimeLanguageSetting?.value || 'en-US';

    // Get SDP offer from browser (raw body buffer)
    let offerSdp: string;
    
    if (Buffer.isBuffer(req.body)) {
      offerSdp = req.body.toString('utf-8');
    } else if (typeof req.body === 'string') {
      offerSdp = req.body;
    } else {
      return res.status(400).json({ error: 'Invalid SDP offer format' });
    }
    
    if (!offerSdp || offerSdp.trim() === '') {
      return res.status(400).json({ error: 'Empty SDP offer' });
    }

    console.log('📡 SDP offer length:', offerSdp.length, 'characters');
    console.log('📡 Using voice:', selectedVoice, 'language:', selectedLanguage);

    console.log('📡 Forwarding SDP to OpenAI Realtime API...');

    // Create FormData per OpenAI WebRTC documentation
    const FormData = require('form-data');
    const fd = new FormData();
    fd.append('sdp', offerSdp);
    
    // Session configuration with dynamic voice and language
    const sessionConfig = JSON.stringify({
      type: "realtime",
      model: "gpt-4o-realtime-preview",
      audio: { 
        output: { voice: selectedVoice }
      },
      instructions: selectedLanguage === 'hy-AM' 
        ? "You are a helpful AI assistant. Please respond in Armenian when the user speaks Armenian. Use clear pronunciation and natural speech patterns."
        : `You are a helpful AI assistant. Please respond in ${selectedLanguage.split('-')[0]} when appropriate.`
    });
    fd.append('session', sessionConfig);

    // Forward SDP to OpenAI Realtime API using correct endpoint
    const openaiResponse = await fetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...fd.getHeaders()
      },
      body: fd
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('❌ OpenAI Realtime API error:', openaiResponse.status, errorText);
      return res.status(openaiResponse.status).json({ 
        error: `OpenAI Realtime API error: ${openaiResponse.status} ${errorText}` 
      });
    }

    // Return SDP answer from OpenAI
    const answerSdp = await openaiResponse.text();
    
    console.log('✅ SDP answer received from OpenAI, forwarding to client');
    
    res.setHeader('Content-Type', 'application/sdp');
    res.send(answerSdp);

  } catch (error) {
    console.error('❌ Realtime API session error:', error);
    res.status(500).json({ error: 'Internal server error during OpenAI Realtime API session' });
  }
});

// Get OpenAI Realtime API capabilities
router.get('/capabilities', async (req: any, res: express.Response) => {
  try {
    const db = getDatabase();
    const get = promisify(db.get.bind(db)) as any;
    
    // Check if OpenAI API key is configured
    const apiKeySetting = await get('SELECT value FROM settings WHERE key = ?', ['openai_api_key']) as any;
    const hasApiKey = !!(apiKeySetting?.value);

    // Get voice and language settings
    const openaiVoiceSetting = await get('SELECT value FROM settings WHERE key = ?', ['openai_voice']) as any;
    const languageSetting = await get('SELECT value FROM settings WHERE key = ?', ['realtime_language']) as any;

    const supportedVoices = [
      { id: 'alloy', name: 'Alloy', description: 'Neutral, balanced voice' },
      { id: 'ash', name: 'Ash', description: 'Deep, authoritative voice' },
      { id: 'ballad', name: 'Ballad', description: 'Soft, melodic voice' },
      { id: 'coral', name: 'Coral', description: 'Warm, friendly voice' },
      { id: 'echo', name: 'Echo', description: 'Clear, professional voice' },
      { id: 'sage', name: 'Sage', description: 'Wise, calming voice' },
      { id: 'shimmer', name: 'Shimmer', description: 'Bright, energetic voice' },
      { id: 'verse', name: 'Verse', description: 'Expressive, dynamic voice' },
      { id: 'marin', name: 'Marin', description: 'Gentle, soothing voice' },
      { id: 'cedar', name: 'Cedar', description: 'Rich, natural voice' }
    ];

    res.json({
      available: hasApiKey,
      model: 'gpt-4o-realtime-preview',
      voice: openaiVoiceSetting?.value || 'alloy',
      language: languageSetting?.value || 'en-US',
      supportedVoices,
      supportedLanguages: [
        { code: 'en-US', name: 'English (US)', nativeSupport: true },
        { code: 'en-GB', name: 'English (UK)', nativeSupport: true },
        { code: 'es-ES', name: 'Spanish', nativeSupport: true },
        { code: 'fr-FR', name: 'French', nativeSupport: true },
        { code: 'de-DE', name: 'German', nativeSupport: true },
        { code: 'hy-AM', name: 'Armenian', nativeSupport: false, hybridMode: true }
      ],
      features: {
        voice_activity_detection: true,
        barge_in: true,
        low_latency: true,
        multilingual_support: true,
        armenian_hybrid_mode: true
      }
    });

  } catch (error) {
    console.error('❌ Realtime API capabilities error:', error);
    res.status(500).json({ error: 'Failed to get OpenAI Realtime API capabilities' });
  }
});

// Get available voices for OpenAI Realtime
router.get('/voices', async (req: any, res: express.Response) => {
  try {
    const voices = [
      { id: 'alloy', name: 'Alloy', description: 'Neutral, balanced voice', gender: 'neutral' },
      { id: 'ash', name: 'Ash', description: 'Deep, authoritative voice', gender: 'masculine' },
      { id: 'ballad', name: 'Ballad', description: 'Soft, melodic voice', gender: 'feminine' },
      { id: 'coral', name: 'Coral', description: 'Warm, friendly voice', gender: 'feminine' },
      { id: 'echo', name: 'Echo', description: 'Clear, professional voice', gender: 'masculine' },
      { id: 'sage', name: 'Sage', description: 'Wise, calming voice', gender: 'feminine' },
      { id: 'shimmer', name: 'Shimmer', description: 'Bright, energetic voice', gender: 'feminine' },
      { id: 'verse', name: 'Verse', description: 'Expressive, dynamic voice', gender: 'masculine' },
      { id: 'marin', name: 'Marin', description: 'Gentle, soothing voice', gender: 'feminine' },
      { id: 'cedar', name: 'Cedar', description: 'Rich, natural voice', gender: 'masculine' }
    ];

    res.json({ voices });
  } catch (error) {
    console.error('❌ Get voices error:', error);
    res.status(500).json({ error: 'Failed to get available voices' });
  }
});

// Update voice setting
router.post('/voice', express.json(), async (req: any, res: express.Response) => {
  try {
    const { voice } = req.body;
    
    const validVoices = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar'];
    
    if (!voice || !validVoices.includes(voice)) {
      return res.status(400).json({ error: 'Invalid voice selection' });
    }

    const db = getDatabase();
    const run = promisify(db.run.bind(db)) as any;

    await run(
      'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
      ['openai_voice', voice, new Date().toISOString()]
    );

    console.log('✅ OpenAI voice updated to:', voice);
    res.json({ success: true, voice });

  } catch (error) {
    console.error('❌ Update voice error:', error);
    res.status(500).json({ error: 'Failed to update voice setting' });
  }
});

export default router;