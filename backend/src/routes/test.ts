import express from 'express';
import { promisify } from 'util';
import { getDatabase } from '../database/init';

const router = express.Router();

// GET /api/test/gemini
router.get('/gemini', async (req, res) => {
  try {
    const db = getDatabase();
    const get = promisify(db.get.bind(db)) as any;

    const setting = await get('SELECT value FROM settings WHERE key = ?', ['gemini_api_key']) as any;
    if (!setting || !setting.value) {
      return res.status(404).json({ success: false, error: 'GEMINI_API_KEY not configured' });
    }

  const apiKey = setting.value;
  let model = (req.query.model as string) || 'gemini-1.5-flash-latest';
  let url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;

    // Minimal test payload
    const body = {
      contents: [
        { role: 'user', parts: [{ text: 'Health check' }] }
      ],
      generationConfig: { maxOutputTokens: 16 }
    };

    let response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok && response.status === 404 && model.endsWith('-latest')) {
      const fallback = model.replace('-latest', '');
  url = `https://generativelanguage.googleapis.com/v1/models/${fallback}:generateContent?key=${apiKey}`;
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    }

    if (!response.ok) {
      const text = await response.text();
      return res.status(502).json({ success: false, error: `Gemini API error: ${response.status}`, details: text });
    }

    const data = await response.json();
    return res.json({ success: true, data });
  } catch (err: any) {
    console.error('Gemini test error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/test/openai
router.get('/openai', async (req, res) => {
  try {
    const db = getDatabase();
    const get = promisify(db.get.bind(db)) as any;

    const setting = await get('SELECT value FROM settings WHERE key = ?', ['openai_api_key']) as any;
    if (!setting || !setting.value) {
      return res.status(404).json({ success: false, error: 'OPENAI_API_KEY not configured' });
    }

    const apiKey = setting.value;
    const url = 'https://api.openai.com/v1/chat/completions';

    const openaiBody = {
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: 'Health check' }, { role: 'user', content: 'Ping' }],
      max_tokens: 16
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(openaiBody)
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(502).json({ success: false, error: `OpenAI API error: ${response.status}`, details: text });
    }

    const data = await response.json();
    return res.json({ success: true, data });
  } catch (err: any) {
    console.error('OpenAI test error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/test/gemini/models - list available models for this key
router.get('/gemini/models', async (req, res) => {
  try {
    const db = getDatabase();
    const get = promisify(db.get.bind(db)) as any;

    const setting = await get('SELECT value FROM settings WHERE key = ?', ['gemini_api_key']) as any;
    if (!setting || !setting.value) {
      return res.status(404).json({ success: false, error: 'GEMINI_API_KEY not configured' });
    }

    const apiKey = setting.value;
    const url = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
    const response = await fetch(url);
    const text = await response.text();
    if (!response.ok) {
      return res.status(502).json({ success: false, error: `Gemini API error: ${response.status}`, details: text });
    }
    try {
      const data = JSON.parse(text);
      return res.json({ success: true, data });
    } catch {
      return res.json({ success: true, raw: text });
    }
  } catch (err: any) {
    console.error('Gemini list models error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
