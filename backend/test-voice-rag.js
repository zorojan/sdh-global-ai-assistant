/**
 * Voice RAG Test Script
 * Тестирует Voice RAG API и WebSocket соединения
 */

const axios = require('axios');
const WebSocket = require('ws');

const BASE_URL = 'http://localhost:3001/api/voice-rag';
const FSM_COMPANY_ID = 'd741629c-16e0-4009-9ced-77f406a7e6d0';

// Цвета для консоли
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

function log(color, message) {
    console.log(`${color}${message}${colors.reset}`);
}

// Тест создания сессии
async function testCreateSession() {
    try {
        log(colors.blue, '\n🎙️ Тестируем создание Voice RAG сессии...');
        
        const response = await axios.post(`${BASE_URL}/session`, {
            agentId: 'fsm-assistant',
            companyId: FSM_COMPANY_ID,
            language: 'hy-AM'
        });
        
        if (response.data.success) {
            log(colors.green, `✅ Сессия создана: ${response.data.session_id}`);
            console.log('   WebSocket URL:', response.data.websocket_url);
            return response.data.session_id;
        } else {
            log(colors.red, '❌ Не удалось создать сессию');
            return null;
        }
        
    } catch (error) {
        log(colors.red, `❌ Ошибка создания сессии: ${error.message}`);
        return null;
    }
}

// Тест обработки текста
async function testProcessText(sessionId = null) {
    try {
        log(colors.blue, '\n🤖 Тестируем обработку текста через RAG...');
        
        const testQueries = [
            'Ինչպես կարող եմ դիմել FSM գրասենյակին?',
            'Վարկային խնդիր ունեմ',
            'Ապահովագրական հաճախորդ եմ'
        ];

        for (const query of testQueries) {
            console.log(`\n   📝 Запрос: "${query}"`);
            
            const response = await axios.post(`${BASE_URL}/process-text`, {
                text: query,
                session_id: sessionId,
                language: 'hy-AM',
                company_id: FSM_COMPANY_ID
            });

            if (response.data.success) {
                log(colors.green, '   ✅ Ответ получен');
                console.log(`   🧠 Источников: ${response.data.knowledge_sources}`);
                console.log(`   📄 Ответ: ${response.data.rag_response.substring(0, 150)}...`);
                
                if (response.data.sources && response.data.sources.length > 0) {
                    console.log('   📚 Источники:');
                    response.data.sources.forEach((source, index) => {
                        console.log(`      ${index + 1}. ${source.title.substring(0, 60)}... (${source.similarity?.toFixed(3)})`);
                    });
                }
            } else {
                log(colors.red, '   ❌ Ошибка обработки');
            }
        }
        
        return true;
        
    } catch (error) {
        log(colors.red, `❌ Ошибка обработки текста: ${error.message}`);
        return false;
    }
}

// Тест WebSocket соединения
async function testWebSocket(sessionId) {
    return new Promise((resolve) => {
        try {
            log(colors.blue, '\n🔌 Тестируем WebSocket соединение...');
            
            const wsUrl = `ws://localhost:3001/api/voice-rag/ws/${sessionId}?sessionId=${sessionId}`;
            const ws = new WebSocket(wsUrl);
            
            let messageReceived = false;
            
            ws.on('open', () => {
                log(colors.green, '✅ WebSocket соединение установлено');
                
                // Отправляем тестовое сообщение
                ws.send(JSON.stringify({
                    type: 'voice_text',
                    text: 'Բարև ձեզ, ինչպես եք?',
                    timestamp: new Date().toISOString()
                }));
                
                console.log('   📤 Отправлено тестовое сообщение');
            });
            
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    console.log(`   📥 Получен ответ: ${message.type}`);
                    
                    if (message.type === 'rag_response') {
                        log(colors.green, '   ✅ RAG ответ получен через WebSocket');
                        console.log(`   🧠 Источников: ${message.knowledge_sources || 0}`);
                        console.log(`   📄 Ответ: ${(message.rag_response || '').substring(0, 100)}...`);
                        messageReceived = true;
                    }
                    
                } catch (parseError) {
                    console.error('   ❌ Ошибка парсинга сообщения:', parseError);
                }
            });
            
            ws.on('error', (error) => {
                log(colors.red, `❌ WebSocket ошибка: ${error.message}`);
                resolve(false);
            });
            
            ws.on('close', () => {
                console.log('   🔌 WebSocket соединение закрыто');
                resolve(messageReceived);
            });
            
            // Закрываем соединение через 5 секунд
            setTimeout(() => {
                ws.close();
            }, 5000);
            
        } catch (error) {
            log(colors.red, `❌ Ошибка WebSocket теста: ${error.message}`);
            resolve(false);
        }
    });
}

// Тест статистики сессий
async function testSessions() {
    try {
        log(colors.blue, '\n📊 Тестируем получение статистики сессий...');
        
        const response = await axios.get(`${BASE_URL}/sessions`);
        
        if (response.data.success) {
            log(colors.green, '✅ Статистика получена');
            console.log(`   🔢 Активных сессий: ${response.data.active_sessions}`);
            console.log(`   ⏱️ Uptime сервера: ${Math.round(response.data.server_uptime / 60)} минут`);
            
            if (response.data.sessions && response.data.sessions.length > 0) {
                console.log('   📋 Сессии:');
                response.data.sessions.forEach((session, index) => {
                    console.log(`      ${index + 1}. ${session.id} (${session.language}, ${session.message_count} сообщений, ${session.duration_minutes} мин)`);
                });
            }
        }
        
        return response.data.success;
        
    } catch (error) {
        log(colors.red, `❌ Ошибка получения статистики: ${error.message}`);
        return false;
    }
}

// Тест health check
async function testHealth() {
    try {
        log(colors.blue, '\n🏥 Тестируем Voice RAG Health Check...');
        
        const response = await axios.get(`${BASE_URL}/health`);
        
        if (response.data.success) {
            log(colors.green, '✅ Voice RAG система здорова');
            console.log('   📊 Статус сервисов:');
            Object.entries(response.data.services).forEach(([service, status]) => {
                console.log(`      ${service}: ${status}`);
            });
            
            if (response.data.test_results) {
                console.log('   🧪 Результаты тестов:');
                Object.entries(response.data.test_results).forEach(([test, result]) => {
                    console.log(`      ${test}: ${result}`);
                });
            }
        }
        
        return response.data.success;
        
    } catch (error) {
        log(colors.red, `❌ Health check failed: ${error.message}`);
        return false;
    }
}

// Основная функция тестирования
async function runAllTests() {
    log(colors.cyan, '🚀 Начинаем тестирование Voice RAG системы...\n');
    
    let passedTests = 0;
    let totalTests = 0;
    let sessionId = null;
    
    // Health check
    totalTests++;
    if (await testHealth()) passedTests++;
    
    // Создание сессии
    totalTests++;
    sessionId = await testCreateSession();
    if (sessionId) passedTests++;
    
    // Обработка текста
    totalTests++;
    if (await testProcessText(sessionId)) passedTests++;
    
    // WebSocket тест (только если сессия создана)
    if (sessionId) {
        totalTests++;
        if (await testWebSocket(sessionId)) passedTests++;
    }
    
    // Статистика сессий
    totalTests++;
    if (await testSessions()) passedTests++;
    
    // Итоговая статистика
    log(colors.cyan, '\n' + '='.repeat(50));
    log(colors.cyan, '📈 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ VOICE RAG');
    log(colors.cyan, '='.repeat(50));
    
    if (passedTests === totalTests) {
        log(colors.green, `✅ Все тесты прошли успешно: ${passedTests}/${totalTests}`);
    } else {
        log(colors.yellow, `⚠️  Пройдено тестов: ${passedTests}/${totalTests}`);
        
        if (passedTests === 0) {
            log(colors.red, '❌ Все тесты провалились. Проверьте:');
            log(colors.red, '   - Запущен ли backend сервер с Voice RAG');
            log(colors.red, '   - Работают ли RAG API endpoints');
            log(colors.red, '   - Доступны ли OpenAI API ключи');
        }
    }
    
    log(colors.cyan, `🕒 Тестирование завершено: ${new Date().toLocaleString()}`);
    
    // Удаляем тестовую сессию если создана
    if (sessionId) {
        try {
            await axios.delete(`${BASE_URL}/session/${sessionId}`);
            log(colors.magenta, `🗑️ Тестовая сессия ${sessionId} удалена`);
        } catch (error) {
            console.warn('⚠️ Не удалось удалить тестовую сессию:', error.message);
        }
    }
}

// Запуск тестов
if (require.main === module) {
    runAllTests().catch(error => {
        log(colors.red, `❌ Критическая ошибка тестирования: ${error.message}`);
        process.exit(1);
    });
}

module.exports = {
    testCreateSession,
    testProcessText,
    testWebSocket,
    testSessions,
    testHealth,
    runAllTests
};