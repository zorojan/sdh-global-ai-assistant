import express from 'express';
import { supabase } from '../database/supabase';
import fetch from 'node-fetch';
import { createSessionFromOffer } from '../services/rt_adapter_openai';

const router = express.Router();

// OpenAI Realtime API Session endpoint - Server-side SDP proxy
router.post('/session', express.raw({ type: 'application/sdp', limit: '10mb' }), async (req: any, res: express.Response) => {
  try {
    console.log('🎤 OpenAI Realtime API session request received');
    
    const agentId = req.query.agentId;
    console.log('🎤 Agent ID:', agentId);

    // Get OpenAI API key from database
    const { data: apiKeySetting, error: apiKeyError } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'openai_api_key')
      .single();
    
    if (apiKeyError || !apiKeySetting?.value) {
      console.error('OpenAI API key fetch error:', apiKeyError);
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const apiKey = apiKeySetting.value;

    // Get agent-specific voice and language settings
    let selectedVoice = 'alloy';
    let selectedLanguage = 'en-US';
    let agentData = null;
    
    if (agentId) {
      const { data: agent } = await supabase
        .from('agents')
        .select('voice, language, voice_language, name, personality, system_prompt')
        .eq('id', agentId)
        .eq('is_active', true)
        .single();
        
      if (agent) {
        agentData = agent;
        selectedVoice = agent.voice || 'alloy';
        selectedLanguage = agent.voice_language || agent.language || 'en-US';
        console.log('🎤 Using agent settings - Voice:', selectedVoice, 'Language:', selectedLanguage);
      }
    } else {
      // Fallback to global settings if no agent specified
      const { data: voiceSettings } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['openai_voice', 'realtime_language']);
      
      if (voiceSettings) {
        const voiceMap = voiceSettings.reduce((acc: any, setting: any) => {
          acc[setting.key] = setting.value;
          return acc;
        }, {});
        
        selectedVoice = voiceMap.openai_voice || 'alloy';
        selectedLanguage = voiceMap.realtime_language || 'en-US';
      }
    }

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
    // Get company information for context
    const { data: companySettings } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['company_name', 'company_description', 'company_website', 'company_documents']);
    
    const companyInfo: any = {};
    if (companySettings) {
      companySettings.forEach((setting: any) => {
        companyInfo[setting.key] = setting.value;
      });
    }

    console.log('📡 Using voice:', selectedVoice, 'language:', selectedLanguage);
    console.log('📡 Forwarding SDP to OpenAI Realtime API via service helper...');

    // Create enhanced instructions with company context
    let instructions = '';
    
    if (agentData) {
      instructions = `${agentData.system_prompt || agentData.personality || 'You are a helpful AI assistant.'}

Company Context:
- Company Name: ${companyInfo.company_name || 'SDH Global'}
- Company Description: ${companyInfo.company_description || ''}
- Website: ${companyInfo.company_website || ''}
- Contact/Address Info: ${companyInfo.company_documents || ''}

You are ${agentData.name} representing ${companyInfo.company_name || 'SDH Global'}.`;
    } else {
      instructions = `You are a helpful AI assistant representing ${companyInfo.company_name || 'SDH Global'}.\n\nCompany Context:\n- Company Name: ${companyInfo.company_name || 'SDH Global'}\n- Company Description: ${companyInfo.company_description || ''}\n- Website: ${companyInfo.company_website || ''}\n- Contact/Address Info: ${companyInfo.company_documents || ''}`;
    }

    // Add language-specific instructions and welcome messages
    if (selectedLanguage === 'hy-AM') {
      instructions += `

IMPORTANT: You MUST respond in Armenian (հայերեն) when the user speaks Armenian. Use clear Armenian pronunciation and natural speech patterns. Always use the exact company information provided above, especially addresses and contact details. Do not make up or guess any company information.

WELCOME MESSAGE: When the conversation starts, immediately greet the user in Armenian. Say something like: "Բարև ձեզ! Ես ${agentData?.name || 'AI օգնական'}ն եմ ${companyInfo.company_name || 'SDH Global'} ընկերությունից: Ինչպե՞ս կարող եմ օգնել ձեզ:" (Hello! I am ${agentData?.name || 'AI assistant'} from ${companyInfo.company_name || 'SDH Global'}. How can I help you?)`;
    } else {
      instructions += `

Language: Please respond primarily in ${selectedLanguage.split('-')[0]}. Always use the exact company information provided above, especially addresses and contact details. Do not make up or guess any company information.

WELCOME MESSAGE: When the conversation starts, immediately greet the user warmly. Say something like: "Hello! I'm ${agentData?.name || 'your AI assistant'} from ${companyInfo.company_name || 'SDH Global'}. How can I help you today?"`;
    }

    // Session configuration with dynamic voice, language, and company context
    const sessionConfig = {
      model: "gpt-4o-realtime-preview",
      voice: selectedVoice,
      instructions: instructions,
      input_audio_transcription: {
        model: "whisper-1"
      }
    };

    console.log('📡 Session config:', JSON.stringify(sessionConfig, null, 2));

    try {
      const responseData: any = await createSessionFromOffer(offerSdp, sessionConfig, apiKey);

      console.log('✅ OpenAI Realtime response received via helper:', {
        hasCallId: !!responseData.call_id,
        hasSdp: !!responseData.sdp,
        sdpLength: responseData.sdp?.length
      });

      const answerSdp = responseData.sdp || responseData.sdp_answer;
      if (!answerSdp) {
        console.error('❌ No SDP answer in OpenAI response:', responseData);
        return res.status(500).json({ error: 'No SDP answer received from OpenAI' });
      }

      console.log('✅ SDP answer forwarded to client, length:', answerSdp.length);
      res.setHeader('Content-Type', 'application/sdp');
      res.send(answerSdp);
    } catch (err: any) {
      console.error('❌ Error calling createSessionFromOffer:', err);
      return res.status(500).json({ error: err.message || 'OpenAI Realtime call failed' });
    }
      console.error('❌ No SDP answer in OpenAI response:', responseData);
      return res.status(500).json({ error: 'No SDP answer received from OpenAI' });
    }
    
    console.log('✅ SDP answer forwarded to client, length:', answerSdp.length);
    
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
    // Check if OpenAI API key is configured
    const { data: apiKeySetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'openai_api_key')
      .single();
    const hasApiKey = !!(apiKeySetting?.value);

    // Get voice and language settings
    const { data: settingsData } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['openai_voice', 'realtime_language']);
    
    const settingsMap = settingsData?.reduce((acc: any, setting: any) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {}) || {};

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
      voice: settingsMap.openai_voice || 'alloy',
      language: settingsMap.realtime_language || 'en-US',
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

    const { error } = await supabase
      .from('settings')
      .upsert({
        key: 'openai_voice',
        value: voice,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key'
      });

    if (error) {
      console.error('❌ Voice update error:', error);
      return res.status(500).json({ error: 'Failed to update voice setting' });
    }

    console.log('✅ OpenAI voice updated to:', voice);
    res.json({ success: true, voice });

  } catch (error) {
    console.error('❌ Update voice error:', error);
    res.status(500).json({ error: 'Failed to update voice setting' });
  }
});

export default router;