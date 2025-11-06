import express, { Request, Response } from 'express';
import fetch from 'node-fetch';
import { supabase } from '../database/supabase';

const router = express.Router();

interface AudioMessageRequest {
  audioBase64: string;
  model?: string;
  ttsModel?: string;
  systemPrompt?: string;
  agentId?: string;
}

/**
 * POST /api/gemini/audio/message
 * Send audio message to Gemini Live Audio API via backend proxy
 */
router.post('/message', async (req: Request, res: Response) => {
  try {
    const { audioBase64, model, ttsModel, systemPrompt, agentId } = req.body as AudioMessageRequest;

    console.log('🎙️ Backend: Received audio message');
    console.log('   Model:', model);
    console.log('   TTS Model:', ttsModel);
    console.log('   Audio size:', Math.round(audioBase64.length / 1024), 'KB');

    // Get API key from settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'gemini_api_key')
      .single();

    if (settingsError || !settingsData) {
      console.error('🎙️ Backend: Gemini API key not found in database');
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    const apiKey = settingsData.value;
    const modelToUse = model || 'gemini-2.5-flash-preview-native-audio-dialog';

    console.log('🎙️ Backend: Calling Gemini API with model:', modelToUse);

    // Call Gemini API with audio
    const payload = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'audio/pcm;rate=16000',
                data: audioBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.8,
        topK: 40,
        topP: 0.95,
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Puck'
            }
          }
        }
      },
      systemInstruction: {
        parts: [
          {
            text: systemPrompt || 'You are a helpful AI assistant.'
          }
        ]
      }
    };

    const startTime = Date.now();
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    const elapsedTime = Date.now() - startTime;
    console.log('🎙️ Backend: Gemini API responded in', elapsedTime, 'ms');

    const result = (await response.json()) as any;

    if (!response.ok) {
      console.error('🎙️ Backend: Gemini API error:', result);
      return res.status(response.status).json({
        error: result.error?.message || 'Gemini API error',
        details: result.error
      });
    }

    // Extract text and audio response
    let textResponse = '';
    let audioResponse: string | null = null;

    if (result.candidates?.[0]?.content?.parts) {
      for (const part of result.candidates[0].content.parts) {
        if (part.text) {
          textResponse += part.text;
          console.log('🎙️ Backend: Extracted text:', textResponse.substring(0, 100));
        }
        if (part.inlineData?.mimeType?.includes('audio')) {
          audioResponse = part.inlineData.data;
          console.log('🎙️ Backend: Extracted audio');
        }
      }
    }

    console.log('🎙️ Backend: Sending response back to frontend');

    res.json({
      success: true,
      text: textResponse || '(no text response)',
      audio: audioResponse || null,
      model: modelToUse,
      ttsModel: ttsModel || 'gemini-2.5-flash',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('🎙️ Backend: Error processing audio message:', error);
    res.status(500).json({
      error: 'Failed to process audio message',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/gemini/audio/session
 * Start new Gemini Live Audio session
 */
router.post('/session', async (req: Request, res: Response) => {
  try {
    const { model, ttsModel, systemPrompt, agentId } = req.body;

    console.log('🎙️ Backend: Starting new audio session');
    console.log('   Model:', model);
    console.log('   TTS Model:', ttsModel);
    console.log('   Agent ID:', agentId);

    // Get API key from settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'gemini_api_key')
      .single();

    if (settingsError || !settingsData) {
      console.error('🎙️ Backend: Gemini API key not found');
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    const apiKey = settingsData.value;
    const modelToUse = model || 'gemini-2.5-flash-preview-native-audio-dialog';

    console.log('🎙️ Backend: Session created successfully');

    res.json({
      success: true,
      session: {
        model: modelToUse,
        ttsModel: ttsModel || 'gemini-2.5-flash',
        systemPrompt: systemPrompt || 'You are a helpful AI assistant.',
        agentId: agentId || 'default',
        endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent`,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('🎙️ Backend: Error creating session:', error);
    res.status(500).json({
      error: 'Failed to create session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/gemini/audio/transcribe
 * Transcribe audio to text
 */
router.post('/transcribe', async (req: Request, res: Response) => {
  try {
    const { audioBase64, model } = req.body;

    console.log('🎙️ Backend: Transcribing audio');

    // Get API key from settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'gemini_api_key')
      .single();

    if (settingsError || !settingsData) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    const apiKey = settingsData.value;
    const modelToUse = model || 'gemini-2.5-flash-preview-native-audio-dialog';

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'audio/pcm;rate=16000',
                data: audioBase64
              }
            },
            {
              text: 'Transcribe this audio to text. Only return the transcribed text, nothing else.'
            }
          ]
        }
      ]
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    const result = (await response.json()) as any;

    if (!response.ok) {
      console.error('🎙️ Backend: Transcription error:', result);
      return res.status(response.status).json({ error: result.error?.message || 'Transcription error' });
    }

    const transcribedText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

    console.log('🎙️ Backend: Transcription complete:', transcribedText.substring(0, 50));

    res.json({
      success: true,
      text: transcribedText
    });

  } catch (error) {
    console.error('🎙️ Backend: Error transcribing audio:', error);
    res.status(500).json({
      error: 'Failed to transcribe audio',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
