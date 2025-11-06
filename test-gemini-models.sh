#!/bin/bash
# Быстрый тест Gemini Live API моделей

echo "🔍 Тестирование доступных Gemini Live моделей..."

API_KEY="AIzaSyAscnWh6-p0v-v2Uoktbd2cjFhaAE_hQmQ"

# Тест 1: Список доступных моделей
echo ""
echo "📋 Получение списка моделей..."
curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=$API_KEY" | grep -o '"name":"[^"]*' | head -20

echo ""
echo ""
echo "🎯 Тестирование конкретных моделей для Gemini Live:"

# Модели для тестирования
models=(
  "gemini-2.5-flash-preview-native-audio-dialog"
  "gemini-2.5-flash-native-audio-preview-09-2025"
  "gemini-2.5-flash-8b-exp-0827"
  "gemini-1.5-pro"
  "gemini-1.5-flash"
)

for model in "${models[@]}"; do
  echo ""
  echo "🧪 Тестирование модели: $model"
  
  response=$(curl -s -w "%{http_code}" -o response.tmp \
    -H "Content-Type: application/json" \
    -d "{
      \"contents\": [{
        \"parts\": [{
          \"text\": \"Hello\"
        }]
      }]
    }" \
    "https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent?key=$API_KEY")
  
  if [ "$response" = "200" ]; then
    echo "✅ $model - РАБОТАЕТ"
  else
    echo "❌ $model - НЕ РАБОТАЕТ (код: $response)"
    if [ -f response.tmp ]; then
      error=$(cat response.tmp | grep -o '"message":"[^"]*' | head -1)
      if [ ! -z "$error" ]; then
        echo "   Ошибка: $error"
      fi
    fi
  fi
  
  rm -f response.tmp
done

echo ""
echo "🎙️ Тестирование Gemini Live WebSocket подключения..."

# Попытка подключения к Gemini Live API
echo "Тестирование WebSocket для Gemini Live..."
node -e "
const WebSocket = require('ws');

const models = [
  'gemini-2.5-flash-native-audio-preview-09-2025',
  'gemini-2.5-flash-preview-native-audio-dialog'
];

models.forEach(model => {
  console.log(\`\\n🔗 Тестирование WebSocket для: \${model}\`);
  
  const ws = new WebSocket(\`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=$API_KEY\`);
  
  ws.on('open', () => {
    console.log(\`✅ \${model} - WebSocket подключен\`);
    
    // Отправка setup сообщения
    ws.send(JSON.stringify({
      setup: {
        model: \`models/\${model}\`,
        generationConfig: {
          responseModalities: ['AUDIO']
        }
      }
    }));
    
    setTimeout(() => ws.close(), 2000);
  });
  
  ws.on('error', (error) => {
    console.log(\`❌ \${model} - WebSocket ошибка: \${error.message}\`);
  });
  
  ws.on('close', (code, reason) => {
    console.log(\`🔒 \${model} - WebSocket закрыт: код \${code}, причина: \${reason}\`);
  });
});
" 2>/dev/null || echo "Node.js не найден, пропускаем WebSocket тест"

echo ""
echo "✅ Тестирование завершено!"
echo ""
echo "💡 Рекомендации:"
echo "1. Используйте модель которая показала ✅ РАБОТАЕТ"
echo "2. Проверьте API ключ если все модели не работают"
echo "3. Для Gemini Live используйте WebSocket совместимые модели"