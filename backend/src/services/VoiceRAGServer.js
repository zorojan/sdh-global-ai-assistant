/**
 * Voice RAG WebSocket Server
 * Интеграция голосового интерфейса с RAG системой
 * Расширяет существующую архитектуру Gemini Live
 */

const WebSocket = require('ws');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
// const genAIModule = require('@google/genai');
// const GoogleGenerativeAI = genAIModule.GoogleGenerativeAI || genAIModule.default || genAIModule;
require('dotenv').config();

class VoiceRAGServer {
    constructor() {
        this.supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        
        // Временно отключаем Gemini API до решения проблемы с библиотекой
        // this.genAI = null;
        console.log('⚠️ Gemini API временно отключен, используем только OpenAI');
        
        this.activeSessions = new Map();
        
        console.log('🎙️ Voice RAG Server инициализирован');
    }

    // Генерация эмбеддинга для поиска
    async generateEmbedding(text) {
        try {
            const response = await axios.post('https://api.openai.com/v1/embeddings', {
                model: "text-embedding-ada-002",
                input: text,
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data.data[0].embedding;
        } catch (error) {
            console.error('❌ VoiceRAG: Ошибка генерации эмбеддинга:', error.message);
            throw error;
        }
    }

    // RAG поиск в базе знаний
    async searchKnowledge(query, companyId = null, language = 'hy-AM') {
        try {
            console.log(`🔍 VoiceRAG: Поиск для "${query.substring(0, 50)}..."`);
            
            // Генерируем эмбеддинг для запроса
            const queryEmbedding = await this.generateEmbedding(query);

            // Выполняем векторный поиск
            const { data: searchResults, error } = await this.supabase.rpc('match_knowledge_base', {
                query_embedding: queryEmbedding,
                match_threshold: 0.6,
                match_count: 3
            });

            if (error) throw error;

            // Фильтруем по компании и языку
            let filteredResults = searchResults || [];
            
            if (companyId) {
                filteredResults = filteredResults.filter(r => r.company_id === companyId);
            }
            
            if (language) {
                filteredResults = filteredResults.filter(r => r.language === language);
            }

            console.log(`✅ VoiceRAG: Найдено ${filteredResults.length} релевантных результатов`);
            
            return filteredResults;

        } catch (error) {
            console.error('❌ VoiceRAG: Ошибка поиска знаний:', error);
            return [];
        }
    }

    // Генерация контекстуального ответа
    async generateRAGResponse(query, knowledgeResults, language = 'hy-AM') {
        try {
            console.log(`🤖 VoiceRAG: Генерация ответа на ${language}`);

            // Если нет релевантных результатов
            if (!knowledgeResults || knowledgeResults.length === 0) {
                const noResultsMessages = {
                    'hy-AM': 'Կներեք, այս հարցի վերաբերյալ տեղեկատվություն չեմ գտել իմ բազայում: Խորհուրդ եմ տալիս դիմել FSM գրասենյակ 060-70-11-11 հեռախոսահամարով:',
                    'en-US': 'Sorry, I could not find information about this question in my database. I recommend contacting FSM office at 060-70-11-11.',
                    'ru-RU': 'Извините, я не нашел информации по этому вопросу в своей базе данных. Рекомендую обратиться в офис FSM по телефону 060-70-11-11.'
                };
                return noResultsMessages[language] || noResultsMessages['hy-AM'];
            }

            // Формируем контекст из найденных документов
            const context = knowledgeResults
                .map((result, index) => `${index + 1}. ${result.title}\n${result.content}`)
                .join('\n\n---\n\n');

            // Системные сообщения для разных языков
            const systemMessages = {
                'hy-AM': 'Դուք FSM (Ֆինանսական համակարգի հաշտարար) AI օգնականն եք: Պատասխանեք հարցերին հիմնվելով տրամադրված տեղեկատվության վրա: Պատասխանները տվեք հայերեն լեզվով, լինեն հստակ, ճիշտ և օգտակար: Խոսեք բարեացակամ տոնով:',
                'en-US': 'You are FSM (Financial System Ombudsman) AI assistant. Answer questions based on the provided information. Give clear, accurate and helpful responses in English with a friendly tone.',
                'ru-RU': 'Вы AI-помощник FSM (Финансовый омbudsman). Отвечайте на вопросы основываясь на предоставленной информации. Давайте четкие, точные и полезные ответы на русском языке дружелюбным тоном.'
            };

            // Генерируем ответ через OpenAI
            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: systemMessages[language] || systemMessages['hy-AM']
                    },
                    {
                        role: "user",
                        content: `Հարց: ${query}\n\nՏեղեկատվություն FSM բազայից:\n${context}\n\nՊատասխան:`
                    }
                ],
                temperature: 0.7,
                max_tokens: 800
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data.choices[0].message.content;

        } catch (error) {
            console.error('❌ VoiceRAG: Ошибка генерации ответа:', error);
            
            // Fallback сообщение
            const errorMessages = {
                'hy-AM': 'Կներեք, տեխնիկական խնդիր է տեղի ունեցել: Խնդրում եմ փորձել մի փոքր ուշ:',
                'en-US': 'Sorry, a technical issue occurred. Please try again in a moment.',
                'ru-RU': 'Извините, произошла техническая ошибка. Пожалуйста, попробуйте через мгновение.'
            };
            
            return errorMessages[language] || errorMessages['hy-AM'];
        }
    }

    // Обработка голосового сообщения с RAG
    async processVoiceMessage(transcribedText, sessionData) {
        try {
            const { companyId, language, agentId } = sessionData;
            
            console.log(`🎙️ VoiceRAG: Обработка сообщения: "${transcribedText}"`);
            
            // Шаг 1: Поиск в базе знаний
            const knowledgeResults = await this.searchKnowledge(
                transcribedText, 
                companyId, 
                language
            );

            // Шаг 2: Генерация ответа на основе найденного контекста
            const ragResponse = await this.generateRAGResponse(
                transcribedText,
                knowledgeResults,
                language
            );

            // Шаг 3: Возвращаем структурированный ответ
            return {
                success: true,
                original_query: transcribedText,
                rag_response: ragResponse,
                knowledge_sources: knowledgeResults.length,
                language: language,
                sources: knowledgeResults.map(r => ({
                    title: r.title,
                    category: r.category,
                    similarity: r.similarity
                }))
            };

        } catch (error) {
            console.error('❌ VoiceRAG: Ошибка обработки голосового сообщения:', error);
            
            return {
                success: false,
                error: error.message,
                fallback_response: 'Կներեք, տեխնիկական խնդիր է տեղի ունեցել:'
            };
        }
    }

    // Создание сессии голосового RAG
    createSession(sessionId, options = {}) {
        const session = {
            id: sessionId,
            companyId: options.companyId || 'd741629c-16e0-4009-9ced-77f406a7e6d0', // FSM по умолчанию
            language: options.language || 'hy-AM',
            agentId: options.agentId || 'fsm-assistant',
            created: new Date(),
            messageCount: 0,
            lastActivity: new Date()
        };

        this.activeSessions.set(sessionId, session);
        console.log(`✅ VoiceRAG: Создана сессия ${sessionId}`);
        
        return session;
    }

    // Получение сессии
    getSession(sessionId) {
        return this.activeSessions.get(sessionId);
    }

    // Удаление сессии
    removeSession(sessionId) {
        this.activeSessions.delete(sessionId);
        console.log(`🗑️ VoiceRAG: Удалена сессия ${sessionId}`);
    }

    // Обновление активности сессии
    updateSessionActivity(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (session) {
            session.lastActivity = new Date();
            session.messageCount++;
        }
    }

    // Очистка неактивных сессий
    cleanupSessions() {
        const now = new Date();
        const maxInactiveTime = 30 * 60 * 1000; // 30 минут

        for (const [sessionId, session] of this.activeSessions.entries()) {
            if (now - session.lastActivity > maxInactiveTime) {
                this.removeSession(sessionId);
            }
        }
    }

    // Статистика сервера
    getStats() {
        return {
            active_sessions: this.activeSessions.size,
            sessions: Array.from(this.activeSessions.values()).map(s => ({
                id: s.id,
                language: s.language,
                message_count: s.messageCount,
                duration_minutes: Math.round((new Date() - s.created) / 60000)
            }))
        };
    }
}

module.exports = VoiceRAGServer;