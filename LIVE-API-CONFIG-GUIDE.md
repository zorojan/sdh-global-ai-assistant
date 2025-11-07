# Live API Configuration Guide

## Обязательные параметры базы данных

Для корректной работы Live API в базе данных должны быть настроены следующие параметры:

### Основные параметры модели
- **`live_api_model`**: Модель Gemini для Live API
  - Тип: `string`
  - Допустимые значения: `"gemini-2.5-flash-native-audio-preview-09-2025"`, `"gemini-2.0-flash-live-001"`
  - По умолчанию: `"gemini-2.5-flash-native-audio-preview-09-2025"`

### Параметры модальности ответа
- **`live_api_response_modalities`**: Модальности ответа AI
  - Тип: `string` (массив в JSON)
  - Допустимые значения: `"AUDIO"`, `"AUDIO+TEXT"`, `"TEXT"`
  - По умолчанию: `"AUDIO"`

### Параметры голоса
- **`live_api_voice_name`**: Имя голоса AI
  - Тип: `string`
  - Допустимые значения: `"Zephyr"`, `"Puck"`, `"Charon"`, `"Kore"`, `"Fenrir"`, `"Leda"`, `"Orus"`, `"Aoede"`, `"Callirrhoe"`, `"Autonoe"`, `"Enceladus"`, `"Iapetus"`, `"Umbriel"`, `"Algieba"`, `"Despina"`
  - По умолчанию: `"Zephyr"`

### Параметры транскрибации
- **`live_api_enable_input_transcription`**: Включить транскрибацию входного аудио
  - Тип: `boolean` (строка `"true"`/`"false"`)
  - По умолчанию: `false`

- **`live_api_enable_output_transcription`**: Включить транскрибацию выходного аудио
  - Тип: `boolean` (строка `"true"`/`"false"`)
  - По умолчанию: `true`

### Параметры температуры
- **`live_api_temperature`**: Температура генерации (креативность)
  - Тип: `number` (строка числа)
  - Диапазон: `0.0` - `2.0`
  - По умолчанию: `0.8`

### Системные инструкции
- **`live_api_system_instruction`**: Системный промпт для AI
  - Тип: `string`
  - По умолчанию: `"You are a helpful AI assistant."`

## Как настроить параметры

### Через админ панель
1. Откройте админ панель: `http://localhost:3000`
2. Перейдите в раздел настроек
3. Найдите параметры с префиксом `live_api_`
4. Измените значения согласно требованиям

### Через API
```bash
# Получить текущие настройки
curl http://localhost:3001/api/settings/diagnostics

# Обновить параметр
curl -X PUT http://localhost:3001/api/settings/live_api_voice_name \
  -H "Content-Type: application/json" \
  -d '{"value": "Aoede"}'
```

## Валидация и нормализация

Backend автоматически:
- ✅ Проверяет допустимые значения голосов
- ✅ Нормализует строки в массивы для модальностей
- ✅ Преобразует строки `"true"`/`"false"` в boolean
- ✅ Ограничивает температуру в диапазоне 0-2
- ✅ Предоставляет разумные дефолты для отсутствующих значений

## Примеры конфигураций

### Базовая аудио конфигурация
```json
{
  "live_api_model": "gemini-2.5-flash-native-audio-preview-09-2025",
  "live_api_response_modalities": "AUDIO",
  "live_api_voice_name": "Zephyr",
  "live_api_enable_input_transcription": "false",
  "live_api_enable_output_transcription": "true",
  "live_api_temperature": "0.8",
  "live_api_system_instruction": "You are a helpful AI assistant."
}
```

### Расширенная конфигурация с транскрибацией
```json
{
  "live_api_model": "gemini-2.5-flash-native-audio-preview-09-2025",
  "live_api_response_modalities": "AUDIO+TEXT",
  "live_api_voice_name": "Aoede",
  "live_api_enable_input_transcription": "true",
  "live_api_enable_output_transcription": "true",
  "live_api_temperature": "1.2",
  "live_api_system_instruction": "You are a friendly Armenian assistant. Always respond in Armenian."
}
```

## Диагностика проблем

### Проверить текущие настройки
```bash
curl http://localhost:3001/api/settings/diagnostics
```

### Проверить нормализованную конфигурацию
```bash
curl http://localhost:3001/api/settings/live-api-config
```

### Логи фронтенда
В браузерной консоли ищите сообщения:
- `🎭 Agent changed` - смена агента
- `🎵 [Agent: Name] Fetching Live API configuration` - загрузка конфига
- `✅ [Agent: Name] Live API configuration loaded` - успешная загрузка

## Troubleshooting

### Проблема: "Failed to fetch Live API config"
**Решение**: Проверьте, что backend запущен и база данных доступна.

### Проблема: Голос не меняется
**Решение**: Убедитесь, что `live_api_voice_name` содержит допустимое имя голоса.

### Проблема: Нет транскрибации
**Решение**: Проверьте параметры `live_api_enable_input_transcription` и `live_api_enable_output_transcription`.

### Проблема: Температура игнорируется
**Решение**: Убедитесь, что `live_api_temperature` в диапазоне 0.0-2.0.