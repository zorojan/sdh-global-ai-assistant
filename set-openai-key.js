// Simple script to set OpenAI API key in database
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./backend/database.sqlite');

// ⚠️ ВНИМАНИЕ: Никогда не храните API ключи в коде!
// Используйте переменные окружения или .env файл
const openaiApiKey = process.env.OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY_HERE';

db.run(
  'UPDATE settings SET value = ? WHERE key = ?',
  [openaiApiKey, 'openai_api_key'],
  function(err) {
    if (err) {
      console.error('Error setting OpenAI API key:', err);
    } else {
      console.log('✅ OpenAI API key set successfully');
      console.log(`   Rows changed: ${this.changes}`);
    }
    db.close();
  }
);

// Also set AI provider to hybrid mode
db.run(
  'UPDATE settings SET value = ? WHERE key = ?',
  ['hybrid', 'ai_provider'],
  function(err) {
    if (err) {
      console.error('Error setting AI provider:', err);
    } else {
      console.log('✅ AI provider set to hybrid mode');
    }
  }
);