const axios = require('axios');

const apiKey = 'AIzaSyAscnWh6-p0v-v2Uoktbd2cjFhaAE_hQmQ';

async function checkAvailableModels() {
  try {
    const response = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    
    console.log('📋 Доступные модели Gemini для generateContent:');
    const models = response.data.models.filter(model => 
      model.name.includes('gemini') && 
      model.supportedGenerationMethods?.includes('generateContent')
    );
    
    models.forEach(model => {
      const name = model.name.replace('models/', '');
      console.log(`   ✅ ${name}`);
    });

    // Найдем подходящую модель для текста
    const textModel = models.find(model => 
      model.name.includes('flash') && 
      !model.name.includes('vision') &&
      !model.name.includes('audio')
    );

    if (textModel) {
      const modelName = textModel.name.replace('models/', '');
      console.log(`\n🎯 Рекомендуемая модель для текста: ${modelName}`);
    }
    
  } catch (error) {
    console.error('❌ Ошибка при проверке моделей:', error.response?.data || error.message);
  }
}

checkAvailableModels();