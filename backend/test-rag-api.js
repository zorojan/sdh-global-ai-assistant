/**
 * RAG API Test Script
 * Тестирует все RAG endpoints
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api/rag';
const FSM_COMPANY_ID = 'd741629c-16e0-4009-9ced-77f406a7e6d0';

// Тестовые данные
const testQueries = [
    {
        query: 'Ինչպես կարող եմ դիմել FSM գրասենյակին?',
        language: 'hy-AM',
        description: 'Общий вопрос о обращении в FSM'
    },
    {
        query: 'Ապահովագրական գործարքի խնդիր ունեմ',
        language: 'hy-AM', 
        category: 'insurance',
        description: 'Вопрос о страховании'
    },
    {
        query: 'Վարկի խնդիր',
        language: 'hy-AM',
        category: 'credit',
        description: 'Вопрос о кредите'
    }
];

// Цвета для консоли
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    cyan: '\x1b[36m'
};

function log(color, message) {
    console.log(`${color}${message}${colors.reset}`);
}

// Тест health endpoint
async function testHealth() {
    try {
        log(colors.blue, '\n🏥 Тестируем RAG Health Check...');
        
        const response = await axios.get(`${BASE_URL}/health`);
        
        if (response.data.success) {
            log(colors.green, '✅ RAG система работает нормально');
            console.log('   Статус сервисов:', response.data.services);
        } else {
            log(colors.red, '❌ RAG система не работает');
        }
        
        return response.data.success;
    } catch (error) {
        log(colors.red, `❌ Health check failed: ${error.message}`);
        return false;
    }
}

// Тест stats endpoint
async function testStats() {
    try {
        log(colors.blue, '\n📊 Получаем статистику базы знаний...');
        
        const response = await axios.get(`${BASE_URL}/stats`);
        
        if (response.data.success) {
            log(colors.green, '✅ Статистика получена');
            console.log(`   📚 Всего документов: ${response.data.total_documents}`);
            console.log('   📂 Категории:', response.data.categories);
            console.log('   🌐 Языки:', response.data.languages);
            console.log('   🏢 Компании:', response.data.companies);
        }
        
        return response.data.success;
    } catch (error) {
        log(colors.red, `❌ Stats failed: ${error.message}`);
        return false;
    }
}

// Тест search endpoint
async function testSearch(testData) {
    try {
        log(colors.blue, `\n🔍 Тестируем поиск: "${testData.query.substring(0, 50)}..."`);
        
        const requestData = {
            query: testData.query,
            company_id: FSM_COMPANY_ID,
            language: testData.language,
            category: testData.category,
            limit: 5,
            threshold: 0.5
        };
        
        const response = await axios.post(`${BASE_URL}/search`, requestData);
        
        if (response.data.success) {
            log(colors.green, `✅ Найдено ${response.data.count} результатов`);
            
            response.data.results.forEach((result, index) => {
                console.log(`   ${index + 1}. ${result.title.substring(0, 80)}...`);
                console.log(`      Similarity: ${result.similarity.toFixed(3)} | Category: ${result.category}`);
            });
        } else {
            log(colors.red, '❌ Поиск не удался');
        }
        
        return response.data.success;
    } catch (error) {
        log(colors.red, `❌ Search failed: ${error.message}`);
        return false;
    }
}

// Тест generate endpoint
async function testGenerate(testData) {
    try {
        log(colors.blue, `\n🤖 Тестируем генерацию ответа: "${testData.query.substring(0, 50)}..."`);
        
        const requestData = {
            query: testData.query,
            company_id: FSM_COMPANY_ID,
            language: testData.language,
            category: testData.category,
            search_limit: 3,
            threshold: 0.7,
            include_sources: true
        };
        
        const response = await axios.post(`${BASE_URL}/generate`, requestData);
        
        if (response.data.success) {
            log(colors.green, '✅ Ответ сгенерирован успешно');
            console.log(`   📝 Ответ (${response.data.answer.length} символов):`);
            console.log(`   "${response.data.answer.substring(0, 200)}..."`);
            console.log(`   🔍 Использовано источников: ${response.data.search_results_count}`);
            
            if (response.data.sources && response.data.sources.length > 0) {
                console.log('   📚 Источники:');
                response.data.sources.forEach((source, index) => {
                    console.log(`      ${index + 1}. ${source.title.substring(0, 60)}... (${source.similarity.toFixed(3)})`);
                });
            }
        } else {
            log(colors.red, '❌ Генерация не удалась');
        }
        
        return response.data.success;
    } catch (error) {
        log(colors.red, `❌ Generate failed: ${error.message}`);
        return false;
    }
}

// Основная функция тестирования
async function runAllTests() {
    log(colors.cyan, '🚀 Начинаем тестирование RAG API endpoints...\n');
    
    let passedTests = 0;
    let totalTests = 0;
    
    // Health check
    totalTests++;
    if (await testHealth()) passedTests++;
    
    // Stats test
    totalTests++;
    if (await testStats()) passedTests++;
    
    // Search tests
    for (const testData of testQueries) {
        totalTests++;
        if (await testSearch(testData)) passedTests++;
    }
    
    // Generate tests
    for (const testData of testQueries) {
        totalTests++;
        if (await testGenerate(testData)) passedTests++;
    }
    
    // Итоговая статистика
    log(colors.cyan, '\n' + '='.repeat(50));
    log(colors.cyan, '📈 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ RAG API');
    log(colors.cyan, '='.repeat(50));
    
    if (passedTests === totalTests) {
        log(colors.green, `✅ Все тесты прошли успешно: ${passedTests}/${totalTests}`);
    } else {
        log(colors.yellow, `⚠️  Пройдено тестов: ${passedTests}/${totalTests}`);
        
        if (passedTests === 0) {
            log(colors.red, '❌ Все тесты провалились. Проверьте:');
            log(colors.red, '   - Запущен ли backend сервер на http://localhost:3001');
            log(colors.red, '   - Правильные ли API ключи в .env файле');
            log(colors.red, '   - Загружены ли данные в базу знаний');
        }
    }
    
    log(colors.cyan, `🕒 Тестирование завершено: ${new Date().toLocaleString()}`);
}

// Запуск тестов
if (require.main === module) {
    runAllTests().catch(error => {
        log(colors.red, `❌ Критическая ошибка тестирования: ${error.message}`);
        process.exit(1);
    });
}

module.exports = {
    testHealth,
    testStats, 
    testSearch,
    testGenerate,
    runAllTests
};