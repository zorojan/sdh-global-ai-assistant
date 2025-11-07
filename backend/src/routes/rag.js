/**
 * RAG Routes - Retrieval Augmented Generation API
 * Endpoints для векторного поиска и генерации ответов на основе базы знаний
 */

const express = require('express');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const router = express.Router();

// Инициализация Supabase
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Функция генерации эмбеддингов
async function generateEmbedding(text) {
    try {
        console.log(`🔤 RAG: Генерируем эмбеддинг для: "${text.substring(0, 50)}..."`);
        
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
        console.error('❌ RAG: Ошибка генерации эмбеддинга:', error.response?.data || error.message);
        throw new Error(`Embedding generation failed: ${error.message}`);
    }
}

// Функция генерации ответа через OpenAI GPT
async function generateResponse(query, context, language = 'hy-AM') {
    try {
        console.log(`🤖 RAG: Генерируем ответ для языка: ${language}`);
        
        // Системное сообщение в зависимости от языка
        const systemMessages = {
            'hy-AM': 'Դուք FSM (Ֆինանսական համակարգի հաշտարար) AI օգնականն եք: Պատասխանեք հարցերին հիմնվելով տրամադրված տեղեկատվության վրա: Պատասխանները տվեք հայերեն լեզվով, լինեն հստակ, ճիշտ և օգտակար:',
            'en-US': 'You are FSM (Financial System Ombudsman) AI assistant. Answer questions based on the provided information. Give clear, accurate and helpful responses in English.',
            'ru-RU': 'Вы AI-помощник FSM (Финансовый омbudsman). Отвечайте на вопросы основываясь на предоставленной информации. Давайте четкие, точные и полезные ответы на русском языке.'
        };

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
            max_tokens: 1000
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('❌ RAG: Ошибка генерации ответа:', error.response?.data || error.message);
        throw new Error(`Response generation failed: ${error.message}`);
    }
}

/**
 * POST /api/rag/search
 * Векторный поиск в базе знаний
 */
router.post('/search', async (req, res) => {
    try {
        const {
            query,
            company_id,
            language = 'hy-AM',
            category,
            limit = 5,
            threshold = 0.5
        } = req.body;

        // Валидация
        if (!query) {
            return res.status(400).json({
                error: 'Query is required',
                message: 'Հարց պարտադիր է'
            });
        }

        console.log(`🔍 RAG Search: "${query}" (lang: ${language}, limit: ${limit})`);

        // Генерируем эмбеддинг для запроса
        const queryEmbedding = await generateEmbedding(query);

        // Строим фильтры для поиска
        let rpcCall = supabase.rpc('match_knowledge_base', {
            query_embedding: queryEmbedding,
            match_threshold: threshold,
            match_count: limit
        });

        // Выполняем поиск
        const { data: searchResults, error: searchError } = await rpcCall;

        if (searchError) {
            console.error('❌ RAG: Ошибка векторного поиска:', searchError);
            throw searchError;
        }

        // Фильтруем результаты по дополнительным критериям
        let filteredResults = searchResults || [];

        if (company_id) {
            filteredResults = filteredResults.filter(r => r.company_id === company_id);
        }

        if (language) {
            filteredResults = filteredResults.filter(r => r.language === language);
        }

        if (category) {
            filteredResults = filteredResults.filter(r => r.category === category);
        }

        console.log(`✅ RAG: Найдено ${filteredResults.length} результатов`);

        res.json({
            success: true,
            query,
            results: filteredResults,
            count: filteredResults.length,
            search_params: {
                language,
                category,
                company_id,
                threshold,
                limit
            }
        });

    } catch (error) {
        console.error('❌ RAG Search Error:', error);
        res.status(500).json({
            error: 'Search failed',
            message: error.message,
            details: 'Որոնման ժամանակ սխալ է տեղի ունեցել'
        });
    }
});

/**
 * POST /api/rag/generate
 * Генерация ответа на основе векторного поиска + GPT
 */
router.post('/generate', async (req, res) => {
    try {
        const {
            query,
            company_id,
            language = 'hy-AM',
            category,
            search_limit = 3,
            threshold = 0.7,
            include_sources = true
        } = req.body;

        // Валидация
        if (!query) {
            return res.status(400).json({
                error: 'Query is required',
                message: 'Հարց պարտադիր է'
            });
        }

        console.log(`🤖 RAG Generate: "${query}" (lang: ${language})`);

        // Шаг 1: Векторный поиск релевантной информации
        const queryEmbedding = await generateEmbedding(query);

        const { data: searchResults, error: searchError } = await supabase.rpc('match_knowledge_base', {
            query_embedding: queryEmbedding,
            match_threshold: threshold,
            match_count: search_limit
        });

        if (searchError) {
            console.error('❌ RAG: Ошибка поиска для генерации:', searchError);
            throw searchError;
        }

        // Фильтруем по критериям
        let relevantResults = searchResults || [];
        
        if (company_id) {
            relevantResults = relevantResults.filter(r => r.company_id === company_id);
        }
        if (language) {
            relevantResults = relevantResults.filter(r => r.language === language);
        }
        if (category) {
            relevantResults = relevantResults.filter(r => r.category === category);
        }

        console.log(`🔍 RAG: Найдено ${relevantResults.length} релевантных документов`);

        // Шаг 2: Формируем контекст из найденных документов
        const context = relevantResults
            .map((result, index) => `${index + 1}. ${result.title}\n${result.content}`)
            .join('\n\n---\n\n');

        // Шаг 3: Генерируем ответ через GPT
        let answer;
        if (context.trim()) {
            answer = await generateResponse(query, context, language);
        } else {
            // Если релевантных документов не найдено
            const noResultsMessages = {
                'hy-AM': 'Կներեք, այս հարցի վերաբերյալ տեղեկատվություն չեմ գտել իմ բազայում: Խորհուրդ եմ տալիս դիմել FSM գրասենյակ 060-70-11-11 հեռախոսահամարով:',
                'en-US': 'Sorry, I could not find information about this question in my database. I recommend contacting FSM office at 060-70-11-11.',
                'ru-RU': 'Извините, я не нашел информации по этому вопросу в своей базе данных. Рекомендую обратиться в офис FSM по телефону 060-70-11-11.'
            };
            answer = noResultsMessages[language] || noResultsMessages['hy-AM'];
        }

        console.log(`✅ RAG: Ответ сгенерирован (${answer.length} символов)`);

        // Формируем ответ
        const response = {
            success: true,
            query,
            answer,
            language,
            search_results_count: relevantResults.length,
            generation_params: {
                search_limit,
                threshold,
                category,
                company_id
            }
        };

        // Добавляем источники если запрошены
        if (include_sources) {
            response.sources = relevantResults.map(result => ({
                id: result.id,
                title: result.title,
                category: result.category,
                similarity: result.similarity,
                metadata: result.metadata
            }));
        }

        res.json(response);

    } catch (error) {
        console.error('❌ RAG Generate Error:', error);
        res.status(500).json({
            error: 'Generation failed',
            message: error.message,
            details: 'Պատասխանի գեներացման ժամանակ սխալ է տեղի ունեցել'
        });
    }
});

/**
 * GET /api/rag/stats
 * Статистика базы знаний
 */
router.get('/stats', async (req, res) => {
    try {
        console.log('📊 RAG: Получаем статистику базы знаний');

        // Общая статистика
        const { data: totalCount, error: countError } = await supabase
            .from('knowledge_base')
            .select('id', { count: 'exact' })
            .eq('is_active', true);

        if (countError) throw countError;

        // Статистика по категориям
        const { data: categoryStats, error: categoryError } = await supabase
            .from('knowledge_base')
            .select('category')
            .eq('is_active', true);

        if (categoryError) throw categoryError;

        const categories = categoryStats.reduce((acc, item) => {
            acc[item.category] = (acc[item.category] || 0) + 1;
            return acc;
        }, {});

        // Статистика по языкам
        const { data: languageStats, error: languageError } = await supabase
            .from('knowledge_base')
            .select('language')
            .eq('is_active', true);

        if (languageError) throw languageError;

        const languages = languageStats.reduce((acc, item) => {
            acc[item.language] = (acc[item.language] || 0) + 1;
            return acc;
        }, {});

        // Статистика по компаниям
        const { data: companyStats, error: companyStatsError } = await supabase
            .from('knowledge_base')
            .select('company_id, companies(name)')
            .eq('is_active', true);

        if (companyStatsError) throw companyStatsError;

        const companies = companyStats.reduce((acc, item) => {
            const companyName = item.companies?.name || 'Unknown';
            acc[companyName] = (acc[companyName] || 0) + 1;
            return acc;
        }, {});

        res.json({
            success: true,
            total_documents: totalCount.length,
            categories,
            languages,
            companies,
            last_updated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ RAG Stats Error:', error);
        res.status(500).json({
            error: 'Stats retrieval failed',
            message: error.message
        });
    }
});

/**
 * GET /api/rag/health
 * Проверка здоровья RAG системы
 */
router.get('/health', async (req, res) => {
    try {
        console.log('🏥 RAG: Health check');

        // Проверяем доступность Supabase
        const { data, error } = await supabase
            .from('knowledge_base')
            .select('id')
            .limit(1);

        if (error) throw error;

        // Проверяем OpenAI API (создаем простой эмбеддинг)
        await generateEmbedding('test');

        res.json({
            success: true,
            status: 'healthy',
            services: {
                supabase: 'connected',
                openai: 'connected',
                vector_search: 'operational'
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ RAG Health Check Failed:', error);
        res.status(503).json({
            success: false,
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;