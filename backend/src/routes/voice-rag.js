/**
 * Voice RAG WebSocket Routes
 * Эндпоинты для голосового RAG взаимодействия
 */

const express = require('express');
const WebSocket = require('ws');
const VoiceRAGServer = require('../services/VoiceRAGServer');

const router = express.Router();
const voiceRAGServer = new VoiceRAGServer();

// Очистка неактивных сессий каждые 5 минут
setInterval(() => {
    voiceRAGServer.cleanupSessions();
}, 5 * 60 * 1000);

/**
 * POST /api/voice-rag/session
 * Создание новой голосовой RAG сессии
 */
router.post('/session', async (req, res) => {
    try {
        const {
            agentId = 'fsm-assistant',
            companyId,
            language = 'hy-AM'
        } = req.body;

        // Генерируем уникальный ID сессии
        const sessionId = `voice-rag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Создаем сессию
        const session = voiceRAGServer.createSession(sessionId, {
            agentId,
            companyId,
            language
        });

        console.log(`🎙️ Создана Voice RAG сессия: ${sessionId}`);

        res.json({
            success: true,
            session_id: sessionId,
            websocket_url: `ws://localhost:3001/api/voice-rag/ws/${sessionId}`,
            session_info: {
                agent_id: agentId,
                company_id: companyId,
                language: language,
                created: session.created
            }
        });

    } catch (error) {
        console.error('❌ Voice RAG Session Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/voice-rag/process-text
 * Обработка текстового сообщения через RAG (для тестирования)
 */
router.post('/process-text', async (req, res) => {
    try {
        const {
            text,
            session_id,
            language = 'hy-AM',
            company_id
        } = req.body;

        if (!text) {
            return res.status(400).json({
                success: false,
                error: 'Text is required'
            });
        }

        // Получаем или создаем сессию
        let session = session_id ? voiceRAGServer.getSession(session_id) : null;
        
        if (!session) {
            const newSessionId = `text-rag-${Date.now()}`;
            session = voiceRAGServer.createSession(newSessionId, {
                language,
                companyId: company_id
            });
        }

        // Обрабатываем сообщение
        const result = await voiceRAGServer.processVoiceMessage(text, session);
        
        // Обновляем активность сессии
        voiceRAGServer.updateSessionActivity(session.id);

        res.json({
            success: true,
            session_id: session.id,
            ...result
        });

    } catch (error) {
        console.error('❌ Voice RAG Text Processing Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/voice-rag/sessions
 * Получение списка активных сессий
 */
router.get('/sessions', (req, res) => {
    try {
        const stats = voiceRAGServer.getStats();
        
        res.json({
            success: true,
            ...stats,
            server_uptime: process.uptime()
        });

    } catch (error) {
        console.error('❌ Voice RAG Sessions Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/voice-rag/session/:sessionId
 * Удаление сессии
 */
router.delete('/session/:sessionId', (req, res) => {
    try {
        const { sessionId } = req.params;
        
        const session = voiceRAGServer.getSession(sessionId);
        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }

        voiceRAGServer.removeSession(sessionId);

        res.json({
            success: true,
            message: 'Session removed',
            session_id: sessionId
        });

    } catch (error) {
        console.error('❌ Voice RAG Session Deletion Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/voice-rag/health
 * Health check для Voice RAG системы
 */
router.get('/health', async (req, res) => {
    try {
        // Проверяем доступность компонентов
        const testText = 'Բարև ձեզ';
        const testSession = {
            companyId: 'd741629c-16e0-4009-9ced-77f406a7e6d0',
            language: 'hy-AM',
            agentId: 'test'
        };

        // Тестируем поиск знаний
        const searchResults = await voiceRAGServer.searchKnowledge(testText, testSession.companyId, testSession.language);
        
        res.json({
            success: true,
            status: 'healthy',
            services: {
                voice_rag_server: 'operational',
                knowledge_search: 'operational',
                active_sessions: voiceRAGServer.getStats().active_sessions
            },
            test_results: {
                search_test: searchResults.length > 0 ? 'passed' : 'no_results',
                found_documents: searchResults.length
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Voice RAG Health Check Error:', error);
        res.status(503).json({
            success: false,
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Экспортируем router и voiceRAGServer для использования в WebSocket
module.exports = {
    router,
    voiceRAGServer
};