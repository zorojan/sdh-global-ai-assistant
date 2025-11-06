import express, { Request, Response } from 'express';
import { supabase } from '../database/supabase';

const router = express.Router();

// Test Gemini API key
router.get('/gemini/test', async (req: Request, res: Response) => {
  try {
    // Get Gemini API key from settings
    const { data: setting, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'gemini_api_key')
      .single();

    if (error || !setting?.value) {
      return res.status(400).json({ 
        success: false, 
        error: 'Gemini API ключ не установлен' 
      });
    }

    const apiKey = setting.value;

    // Test the API key with a simple request to Gemini
    const testResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      return res.status(400).json({
        success: false,
        error: `Неверный API ключ Gemini. ${testResponse.status}: ${testResponse.statusText}`
      });
    }

    const result = await testResponse.json() as any;
    
    // Check if we got valid models response
    if (result.models && Array.isArray(result.models)) {
      return res.json({
        success: true,
        message: 'Gemini API ключ действителен',
        modelsCount: result.models.length
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Неожиданный ответ от Gemini API'
      });
    }

  } catch (error: any) {
    console.error('Gemini API test error:', error);
    return res.status(500).json({
      success: false,
      error: `Ошибка тестирования Gemini API: ${error.message}`
    });
  }
});

// Test OpenAI API key
router.get('/openai/test', async (req: Request, res: Response) => {
  try {
    // Get OpenAI API key from settings
    const { data: setting, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'openai_api_key')
      .single();

    if (error || !setting?.value) {
      return res.status(400).json({ 
        success: false, 
        error: 'OpenAI API ключ не установлен' 
      });
    }

    const apiKey = setting.value;

    // Test the API key with a simple request to OpenAI models endpoint
    const testResponse = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      return res.status(400).json({
        success: false,
        error: `Неверный API ключ OpenAI. ${testResponse.status}: ${testResponse.statusText}`
      });
    }

    const result = await testResponse.json() as any;
    
    // Check if we got valid models response
    if (result.data && Array.isArray(result.data)) {
      return res.json({
        success: true,
        message: 'OpenAI API ключ действителен',
        modelsCount: result.data.length
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Неожиданный ответ от OpenAI API'
      });
    }

  } catch (error: any) {
    console.error('OpenAI API test error:', error);
    return res.status(500).json({
      success: false,
      error: `Ошибка тестирования OpenAI API: ${error.message}`
    });
  }
});

export default router;