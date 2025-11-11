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
// Кеш для быстрых ответов (в памяти)
const responseCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

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
            'hy-AM': 'Դուք FSM (Ֆինանսական համակարգի հաշտարար) AI օգնականն եք: ԿԱՐԵՎՈՐ: Պատասխանեք ՄԻԱՅՆ տրամադրված տեղեկատվության հիման վրա: Եթե տեղեկատվությունում կա ճշգրիտ պատասխան, օգտագործեք այն բառացիորեն: ՄԻ ՓՈԽԵՔ բովանդակությունը:',
            'en-US': 'You are FSM (Financial System Ombudsman) AI assistant. IMPORTANT: Answer ONLY based on the provided information. If there is an exact answer in the information, use it verbatim. DO NOT change the content.',
            'ru-RU': 'Вы AI-помощник FSM (Финансовый омbudsman). ВАЖНО: Отвечайте ТОЛЬКО на основе предоставленной информации. Если в информации есть точный ответ, используйте его дословно. НЕ ИЗМЕНЯЙТЕ содержание.'
        };

        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "user",
                    content: `${context}\n\nՀարց: ${query}\n\nՊատասխան (copy exact text):`
                }
            ],
            temperature: 0,
            top_p: 0.1,
            frequency_penalty: 0.0,
            presence_penalty: 0.0,
            max_tokens: 200
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
    const startTime = Date.now();
    
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

        // БЫСТРЫЙ КЕШ - проверяем сначала кеш
        const cacheKey = `${query}_${company_id}_${language}`;
        const cached = responseCache.get(cacheKey);
        
        if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
            const duration = Date.now() - startTime;
            console.log(`⚡ RAG CACHE HIT: "${query}" (${duration}ms)`);
            return res.json({
                ...cached.response,
                cached: true,
                generation_time_ms: duration
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

        // Шаг 2: Формируем контекст только из высокорелевантных документов (similarity > 0.8)
        const highRelevantResults = relevantResults.filter(r => r.similarity > 0.8);
        
        // Берем только топ-2 результата для минимизации контекста
        const topResults = highRelevantResults.slice(0, 2);
        
        const context = topResults
            .map((result, index) => `Document ${index + 1}: ${result.content}`)
            .join('\n\n---\n\n');

        console.log(`🔍 RAG: Отфильтровано ${topResults.length} высокорелевантных документов (similarity > 0.8)`);

        // Шаг 3: Генерируем ответ - для очень высокого similarity возвращаем напрямую
        let answer;
        if (context.trim()) {
            // Если есть результат с очень высокой точностью (> 0.90), возвращаем напрямую
            const bestResult = topResults[0];
            console.log(`🔍 RAG DEBUG: topResults.length=${topResults.length}, bestResult=${!!bestResult}`);
            if (bestResult) {
                console.log(`🔍 RAG DEBUG: similarity=${bestResult.similarity}, threshold=0.90`);
            }
            
            if (bestResult && bestResult.similarity > 0.90) {
                // Извлекаем ответ из контента (после "Պատասխան:")
                const contentMatch = bestResult.content.match(/Պատասխան:\s*(.+)/s);
                console.log(`🔍 RAG DEBUG: contentMatch=${!!contentMatch}`);
                if (contentMatch) {
                    answer = contentMatch[1].trim();
                    console.log(`🎯 RAG: Прямой ответ из базы (similarity: ${bestResult.similarity})`);
                } else {
                    console.log(`⚠️ RAG: Regex не сработал, используем OpenAI`);
                    answer = await generateResponse(query, context, language);
                }
            } else {
                console.log(`⚠️ RAG: Similarity слишком низкая или нет результатов, используем OpenAI`);
                answer = await generateResponse(query, context, language);
            }
        } else {
            // Если релевантных документов не найдено
            const noResultsMessages = {
                'hy-AM': 'Կներեք, այս հարցի վերաբերյալ տեղեկատվություն չեմ գտել իմ բազայում: Խորհուրդ եմ տալիս դիմել FSM գրասենյակ 060-70-11-11 հեռախոսահամարով:',
                'en-US': 'Sorry, I could not find information about this question in my database. I recommend contacting FSM office at 060-70-11-11.',
                'ru-RU': 'Извините, я не нашел информации по этому вопросу в своей базе данных. Рекомендую обратиться в офис FSM по телефону 060-70-11-11.'
            };
            answer = noResultsMessages[language] || noResultsMessages['hy-AM'];
        }

        const duration = Date.now() - startTime;
        console.log(`✅ RAG: Ответ сгенерирован (${answer.length} символов, ${duration}ms)`);

        // Формируем ответ
        const response = {
            success: true,
            query,
            answer,
            language,
            search_results_count: relevantResults.length,
            generation_time_ms: duration,
            generation_params: {
                search_limit,
                threshold,
                category,
                company_id
            }
        };

        // Кешируем результат для быстрых повторных запросов
        if (topResults.length > 0 && topResults[0].similarity > 0.85) {
            responseCache.set(cacheKey, {
                response: response,
                timestamp: Date.now()
            });
            console.log(`💾 RAG: Результат закеширован для быстрого доступа`);
        }

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

/**
 * POST /api/rag/fast-search
 * Сверхбыстрый поиск без генерации для real-time аудио
 */
router.post('/fast-search', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const { query, company_id, language = 'hy-AM' } = req.body;
        
        if (!query) {
            return res.status(400).json({ error: 'Query required' });
        }

        // Быстрый кеш-чек
        const cacheKey = `fast_${query}_${company_id}`;
        const cached = responseCache.get(cacheKey);
        
        if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
            return res.json({ 
                ...cached.response, 
                cached: true,
                search_time_ms: Date.now() - startTime 
            });
        }

        // Только векторный поиск, без OpenAI
        const queryEmbedding = await generateEmbedding(query);
        const { data: results, error } = await supabase.rpc('match_knowledge_base', {
            query_embedding: queryEmbedding,
            match_threshold: 0.7, // Понижено с 0.85 для лучшего поиска
            match_count: 1 // Только лучший результат
        });

        if (error) throw error;

        console.log(`🔍 RAG Fast Search: query="${query}" found ${results?.length || 0} results`);
        if (results?.length > 0) {
            console.log('First result:', {
                similarity: results[0].similarity,
                company_id: results[0].company_id,
                language: results[0].language,
                title: results[0].title?.substring(0, 50)
            });
        }

        let answer = null;
        const filteredResults = results?.filter(r => 
            r.company_id === company_id && 
            r.language === language &&
            r.similarity > 0.75 // Понижено с 0.90 для лучшего поиска
        ) || [];

        console.log(`🔍 RAG Fast Search: after filtering ${filteredResults.length} results`);
        if (filteredResults.length > 0) {
            console.log('Filtered result:', {
                similarity: filteredResults[0].similarity,
                title: filteredResults[0].title?.substring(0, 50)
            });
        }

        // Если есть очень точный результат, возвращаем напрямую
        if (filteredResults.length > 0) {
            const bestResult = filteredResults[0];
            const contentMatch = bestResult.content.match(/Պատասխան:\s*(.+)/s);
            if (contentMatch) {
                answer = contentMatch[1].trim();
            }
        }

        const response = {
            success: !!answer,
            query,
            answer,
            similarity: filteredResults[0]?.similarity || 0,
            search_time_ms: Date.now() - startTime,
            fast_mode: true,
            // Debug info
            debug: {
                total_results: results?.length || 0,
                filtered_results: filteredResults.length,
                first_result: results?.[0] ? {
                    similarity: results[0].similarity,
                    company_id: results[0].company_id,
                    language: results[0].language
                } : null
            }
        };

        // Кешируем быстрый результат
        if (answer) {
            responseCache.set(cacheKey, {
                response: response,
                timestamp: Date.now()
            });
        }

        res.json(response);

    } catch (error) {
        console.error('❌ Fast RAG search error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Fast search failed',
            search_time_ms: Date.now() - startTime 
        });
    }
});

module.exports = router;