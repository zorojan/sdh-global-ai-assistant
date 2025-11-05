const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

console.log('🔧 Исправление модели Gemini...');

try {
  // Обновляем устаревшую модель gemini-pro на gemini-1.5-flash
  const updateModel = db.prepare(`
    UPDATE settings 
    SET value = 'gemini-1.5-flash' 
    WHERE key = 'message_dialog_model' AND value = 'gemini-pro'
  `);

  const result = updateModel.run();
  if (result.changes > 0) {
    console.log('✅ Обновлена модель: gemini-pro → gemini-1.5-flash');
  } else {
    console.log('🔄 Модель уже актуальна или не найдена');
  }

  // Также обновим default_model если там gemini-pro
  const updateDefaultModel = db.prepare(`
    UPDATE settings 
    SET value = 'gemini-1.5-flash' 
    WHERE key = 'default_model' AND (value = 'gemini-pro' OR value LIKE '%gemini-pro%')
  `);

  const result2 = updateDefaultModel.run();
  if (result2.changes > 0) {
    console.log('✅ Обновлена default_model: gemini-pro → gemini-1.5-flash');
  }

  // Проверяем текущие настройки моделей
  console.log('\n📋 Текущие настройки моделей:');
  const models = db.prepare("SELECT key, value FROM settings WHERE key LIKE '%model%' ORDER BY key").all();
  
  models.forEach(setting => {
    console.log(`   ${setting.key}: ${setting.value}`);
  });

  // Убедимся что есть правильные модели
  const requiredModels = [
    ['message_dialog_model', 'gemini-1.5-flash', 'Gemini model for text conversations'],
    ['default_model', 'gemini-1.5-flash', 'Default Gemini model for voice conversations'],
    ['gemini_tts_model', 'gemini-2.5-flash-tts', 'Gemini Text-to-Speech model']
  ];

  requiredModels.forEach(([key, value, description]) => {
    const insertModel = db.prepare(`
      INSERT OR IGNORE INTO settings (key, value, type, description) 
      VALUES (?, ?, 'select', ?)
    `);
    const result = insertModel.run(key, value, description);
    if (result.changes > 0) {
      console.log(`✅ Добавлена модель: ${key} = ${value}`);
    }
  });

  console.log('\n🎉 Модели обновлены успешно!');

} catch (error) {
  console.error('❌ Ошибка при обновлении моделей:', error);
} finally {
  db.close();
}