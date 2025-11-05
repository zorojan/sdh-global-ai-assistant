const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

console.log('🔧 Добавление новых настроек Gemini TTS...');

try {
  // Проверим структуру таблицы settings
  const tableInfo = db.prepare("PRAGMA table_info(settings)").all();
  console.log('📊 Структура таблицы settings:');
  tableInfo.forEach(col => console.log(`   ${col.name}: ${col.type}`));

  // Добавляем новые настройки Gemini TTS (без category если её нет)
  const insertSettings = db.prepare(`
    INSERT OR IGNORE INTO settings (key, value, type, description) 
    VALUES (?, ?, ?, ?)
  `);

  const geminiTtsSettings = [
    [
      'gemini_default_voice', 
      'Kore', 
      'select', 
      'Default Gemini voice for TTS (Kore recommended for Armenian)'
    ],
    [
      'gemini_default_language', 
      'hy-AM', 
      'select', 
      'Default Gemini language (hy-AM=Armenian, en-US=English, ru-RU=Russian, auto=Auto-detect)'
    ],
    [
      'gemini_tts_model', 
      'gemini-2.5-flash-tts', 
      'select', 
      'Gemini Text-to-Speech model (flash for speed, pro for quality)'
    ]
  ];

  geminiTtsSettings.forEach(setting => {
    const result = insertSettings.run(...setting);
    if (result.changes > 0) {
      console.log(`✅ Добавлено: ${setting[0]} = ${setting[1]}`);
    } else {
      console.log(`🔄 Уже существует: ${setting[0]}`);
    }
  });

  // Проверяем все настройки Gemini
  console.log('\n📋 Текущие настройки Gemini:');
  const geminiSettings = db.prepare("SELECT key, value, description FROM settings WHERE key LIKE '%gemini%' ORDER BY key").all();
  
  geminiSettings.forEach(setting => {
    console.log(`   ${setting.key}: ${setting.value} - ${setting.description}`);
  });

  console.log('\n🎉 Обновление завершено успешно!');

} catch (error) {
  console.error('❌ Ошибка при обновлении базы данных:', error);
} finally {
  db.close();
}