/**
 * FSM FAQ Migration to Vector Database
 * Загружает структурированные FAQ данные в Supabase с векторизацией через OpenAI
 */

const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Инициализация клиентов
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ID компании FSM из базы данных
const FSM_COMPANY_ID = 'd741629c-16e0-4009-9ced-77f406a7e6d0';

// Функция генерации эмбеддингов через OpenAI API
async function generateEmbedding(text) {
    try {
        console.log(`🔤 Генерируем эмбеддинг для текста: ${text.substring(0, 50)}...`);
        
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
        console.error('❌ Ошибка генерации эмбеддинга:', error.response?.data || error.message);
        throw error;
    }
}

// Функция загрузки одной FAQ записи
async function insertFAQEntry(faqEntry) {
    try {
        // Генерируем эмбеддинг для контента
        const embedding = await generateEmbedding(faqEntry.content);
        
        // Подготавливаем данные для вставки
        const knowledgeBaseEntry = {
            company_id: FSM_COMPANY_ID,
            title: faqEntry.title,
            content: faqEntry.content,
            category: faqEntry.category,
            subcategory: faqEntry.subcategory,
            language: faqEntry.language,
            source_type: faqEntry.source_type,
            tags: faqEntry.tags,
            embedding: embedding,
            metadata: faqEntry.metadata,
            is_active: true
        };

        // Вставляем в базу данных
        const { data, error } = await supabase
            .from('knowledge_base')
            .insert(knowledgeBaseEntry)
            .select();

        if (error) {
            console.error('❌ Ошибка вставки в БД:', error);
            throw error;
        }

        console.log(`✅ Загружен FAQ #${faqEntry.metadata.question_number}: ${faqEntry.title.substring(0, 50)}...`);
        return data[0];
        
    } catch (error) {
        console.error(`❌ Ошибка загрузки FAQ ${faqEntry.id}:`, error.message);
        throw error;
    }
}

// Основная функция миграции
async function migrateFAQToDatabase() {
    try {
        console.log('🚀 Начинаем миграцию FAQ в базу знаний...\n');

        // Читаем структурированные данные FAQ
        const faqDataPath = path.join(__dirname, 'faq-structured-data.json');
        if (!fs.existsSync(faqDataPath)) {
            throw new Error('Файл faq-structured-data.json не найден. Запустите сначала parse-faq-data.js');
        }

        const faqData = JSON.parse(fs.readFileSync(faqDataPath, 'utf8'));
        console.log(`📊 Найдено ${faqData.length} FAQ записей для загрузки`);

        // Проверяем, что таблица knowledge_base пуста или спрашиваем подтверждение
        const { data: existingData, error: countError } = await supabase
            .from('knowledge_base')
            .select('id')
            .eq('company_id', FSM_COMPANY_ID)
            .eq('source_type', 'faq');

        if (countError) {
            throw new Error(`Ошибка проверки существующих данных: ${countError.message}`);
        }

        if (existingData && existingData.length > 0) {
            console.log(`⚠️  В базе уже есть ${existingData.length} FAQ записей для FSM`);
            console.log('Для продолжения удалите существующие записи или измените скрипт\n');
            
            // Удаляем существующие FAQ записи FSM
            const { error: deleteError } = await supabase
                .from('knowledge_base')
                .delete()
                .eq('company_id', FSM_COMPANY_ID)
                .eq('source_type', 'faq');
                
            if (deleteError) {
                throw new Error(`Ошибка удаления существующих записей: ${deleteError.message}`);
            }
            
            console.log('✅ Существующие FAQ записи удалены');
        }

        // Загружаем FAQ записи с ограничением на rate limiting
        const batchSize = 5; // Загружаем по 5 записей за раз
        const delay = 1000; // 1 секунда между батчами для rate limiting
        
        let processedCount = 0;
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < faqData.length; i += batchSize) {
            const batch = faqData.slice(i, i + batchSize);
            
            console.log(`\n📦 Обрабатываем батч ${Math.floor(i/batchSize) + 1}/${Math.ceil(faqData.length/batchSize)}`);
            
            // Обрабатываем батч параллельно
            const batchPromises = batch.map(async (faqEntry) => {
                try {
                    await insertFAQEntry(faqEntry);
                    successCount++;
                } catch (error) {
                    console.error(`❌ Ошибка в FAQ ${faqEntry.id}: ${error.message}`);
                    errorCount++;
                }
                processedCount++;
            });

            await Promise.all(batchPromises);
            
            // Пауза между батчами
            if (i + batchSize < faqData.length) {
                console.log(`⏱️  Пауза ${delay}мс...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        // Финальная статистика
        console.log('\n' + '='.repeat(50));
        console.log('📈 ИТОГОВАЯ СТАТИСТИКА МИГРАЦИИ');
        console.log('='.repeat(50));
        console.log(`✅ Успешно загружено: ${successCount}`);
        console.log(`❌ Ошибок: ${errorCount}`);
        console.log(`📊 Всего обработано: ${processedCount}`);
        console.log(`🏢 Компания: FSM (${FSM_COMPANY_ID})`);
        
        // Проверяем результат в базе
        const { data: finalCount, error: finalCountError } = await supabase
            .from('knowledge_base')
            .select('id', { count: 'exact' })
            .eq('company_id', FSM_COMPANY_ID)
            .eq('source_type', 'faq');

        if (finalCountError) {
            console.warn('⚠️  Не удалось проверить финальное количество записей');
        } else {
            console.log(`🔍 Записей в базе данных: ${finalCount.length}`);
        }

        console.log('\n🎉 Миграция завершена успешно!');

    } catch (error) {
        console.error('\n❌ Критическая ошибка миграции:', error.message);
        process.exit(1);
    }
}

// Функция тестирования векторного поиска
async function testVectorSearch(query = 'Как подать жалобу в банк?') {
    try {
        console.log(`\n🔍 Тестируем векторный поиск: "${query}"`);
        
        // Генерируем эмбеддинг для запроса
        const queryEmbedding = await generateEmbedding(query);
        
        // Выполняем векторный поиск
        const { data, error } = await supabase.rpc('match_knowledge_base', {
            query_embedding: queryEmbedding,
            match_threshold: 0.5,
            match_count: 3
        });

        if (error) {
            throw error;
        }

        console.log(`✅ Найдено ${data.length} релевантных результатов:`);
        data.forEach((result, index) => {
            console.log(`\n${index + 1}. Similarity: ${result.similarity.toFixed(3)}`);
            console.log(`   Title: ${result.title.substring(0, 80)}...`);
            console.log(`   Category: ${result.category}`);
        });

    } catch (error) {
        console.error('❌ Ошибка тестирования поиска:', error.message);
    }
}

// Запуск миграции
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.includes('--test')) {
        testVectorSearch(args[args.indexOf('--test') + 1]);
    } else {
        migrateFAQToDatabase();
    }
}

module.exports = {
    migrateFAQToDatabase,
    generateEmbedding,
    testVectorSearch
};