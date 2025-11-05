import express from 'express';
import { getDatabase } from '../database/init';
import { promisify } from 'util';
import fetch from 'node-fetch';

const router = express.Router();

// OpenAI Realtime API Session endpoint - Server-side SDP proxy
router.post('/session', async (req: any, res: express.Response) => {
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

    // Get SDP offer from browser
    const offerSdp = req.body;
    
    if (!offerSdp || typeof offerSdp !== 'string') {
      return res.status(400).json({ error: 'Invalid SDP offer' });
    }

    console.log('📡 Forwarding SDP to OpenAI Realtime API...');

    // Forward SDP to OpenAI Realtime API
    const openaiResponse = await fetch('https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/sdp'
      },
      body: offerSdp
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

    // Get voice settings
    const voiceSetting = await get('SELECT value FROM settings WHERE key = ?', ['default_voice']) as any;
    const languageSetting = await get('SELECT value FROM settings WHERE key = ?', ['default_language']) as any;

    res.json({
      available: hasApiKey,
      model: 'gpt-4o-realtime-preview',
      voice: voiceSetting?.value || 'nova',
      language: languageSetting?.value || 'hy-AM',
      features: {
        voice_activity_detection: true,
        barge_in: true,
        armenian_support: true,
        low_latency: true
      }
    });

  } catch (error) {
    console.error('❌ Realtime API capabilities error:', error);
    res.status(500).json({ error: 'Failed to get OpenAI Realtime API capabilities' });
  }
});

export default router;