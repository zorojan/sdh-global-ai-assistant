/**
 * FSM FAQ Data Parser
 * Парсит fsm-faq.md и создает структурированный JSON для загрузки в базу знаний
 */

const fs = require('fs');
const path = require('path');

// Читаем файл FAQ
function parseFAQFile() {
    try {
        const faqPath = path.join(__dirname, '..', 'fsm-faq.md');
        const content = fs.readFileSync(faqPath, 'utf8');
        
        console.log('📖 Читаем FAQ файл...');
        console.log(`✅ Файл загружен, размер: ${content.length} символов`);
        
        // Парсим структуру FAQ
        const faqData = parseContent(content);
        
        // Сохраняем структурированные данные
        const outputPath = path.join(__dirname, 'faq-structured-data.json');
        fs.writeFileSync(outputPath, JSON.stringify(faqData, null, 2), 'utf8');
        
        console.log(`✅ Структурированные данные сохранены в: ${outputPath}`);
        console.log(`📊 Обработано ${faqData.length} FAQ записей`);
        
        // Показываем статистику по категориям
        const categoryStats = faqData.reduce((acc, item) => {
            acc[item.category] = (acc[item.category] || 0) + 1;
            return acc;
        }, {});
        
        console.log('\n📈 Статистика по категориям:');
        Object.entries(categoryStats).forEach(([category, count]) => {
            console.log(`  ${category}: ${count} вопросов`);
        });
        
        return faqData;
        
    } catch (error) {
        console.error('❌ Ошибка при парсинге FAQ:', error.message);
        process.exit(1);
    }
}

// Парсим содержимое markdown файла
function parseContent(content) {
    const faqEntries = [];
    let currentCategory = 'general';
    
    // Разбиваем на строки для обработки
    const lines = content.split('\n');
    let currentQuestion = '';
    let currentAnswer = '';
    let questionNumber = 0;
    let inAnswer = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Проверяем на новую категорию
        if (line.match(/^\*\*[^*]+\*\*$/)) {
            const categoryText = line.replace(/\*\*/g, '').trim();
            currentCategory = mapCategory(categoryText);
            console.log(`📂 Найдена категория: ${categoryText} -> ${currentCategory}`);
            continue;
        }
        
        // Проверяем на новый вопрос (нумерованный)
        const questionMatch = line.match(/^(\d+)\.\s+\*\*\*([^*]+)\*\*\*/);
        if (questionMatch) {
            // Сохраняем предыдущий вопрос если есть
            if (currentQuestion && currentAnswer) {
                faqEntries.push(createFAQEntry(questionNumber, currentQuestion, currentAnswer, currentCategory));
            }
            
            questionNumber = parseInt(questionMatch[1]);
            currentQuestion = questionMatch[2].trim();
            currentAnswer = '';
            inAnswer = true;
            console.log(`❓ Найден вопрос ${questionNumber}: ${currentQuestion.substring(0, 50)}...`);
            continue;
        }
        
        // Собираем ответ
        if (inAnswer && line && !line.match(/^\d+\.\s+\*\*\*/)) {
            if (currentAnswer) currentAnswer += '\n';
            currentAnswer += line;
        }
    }
    
    // Не забываем последний вопрос
    if (currentQuestion && currentAnswer) {
        faqEntries.push(createFAQEntry(questionNumber, currentQuestion, currentAnswer, currentCategory));
    }
    
    return faqEntries;
}

// Создает объект FAQ записи
function createFAQEntry(number, question, answer, category) {
    return {
        id: `faq_${category}_${number}`,
        title: question.trim(),
        content: `Հարց: ${question.trim()}\n\nՊատասխան: ${answer.trim()}`,
        category: category,
        subcategory: extractSubcategory(question.trim()),
        language: 'hy-AM',
        source_type: 'faq',
        tags: extractTags(question.trim(), answer.trim()),
        metadata: {
            question_number: number,
            original_category: category,
            word_count: (question + answer).split(/\s+/).length,
            character_count: (question + answer).length
        }
    };
}

// Мапинг категорий на русский/английский для удобства
function mapCategory(armenianCategory) {
    const categoryMap = {
        'ԸՆԴՀԱՆՈՒՐ ՀԱՐՑԵՐ': 'general',
        'ԱՊԱՀՈՎԱԳՐՈՒԹՅՈՒՆ': 'insurance', 
        'ԱՊՊԱ': 'mtpl',
        'ԿԱՍԿՈ': 'casco',
        'ԳՅՈՒՂԱՏՆՏԵՍՈՒԹՅՈՒՆ': 'agriculture',
        'ԱՌՈՂՋՈՒԹՅՈՒՆ': 'health',
        'ՎԱՐԿԱՅԻՆ ՊԱՐՏԱՎՈՐՈՒԹՅՈՒՆ': 'credit',
        'ԶԵՂԾԱՐԱՐՈՒԹՅՈՒՆ': 'fraud',
        'ՎՃԱՐԱՀԱՇՎԱՐԿԱՅԻՆ ԳՈՐԾԱՐՔՆԵՐ': 'payments',
        'ԿՐԻՊՏՈԱՐԺՈՒՅԹ': 'crypto',
        'ԱՎԱՆԴ': 'deposit',
        'ՉԵՆ ՎԵՐԱԲԵՐՈՒՄ ՖԻՆԱՆՍԱԿԱՆ ՀԱՄԱԿԱՐԳԻՆ': 'non_financial'
    };
    
    return categoryMap[armenianCategory] || 'general';
}

// Извлекаем подкategory из текста вопроса
function extractSubcategory(question) {
    // Простые правила для определения подкатегории
    if (question.includes('ԱՊՊԱ')) return 'mtpl_claims';
    if (question.includes('վարկ')) return 'credit_issues';
    if (question.includes('հատուցում')) return 'compensation';
    if (question.includes('բանկ')) return 'banking';
    if (question.includes('քարտ')) return 'cards';
    if (question.includes('ապահովագրություն')) return 'insurance_general';
    
    return null;
}

// Извлекаем теги из текста
function extractTags(question, answer) {
    const text = (question + ' ' + answer).toLowerCase();
    const tags = [];
    
    // Ключевые слова для тегов
    const tagKeywords = {
        'վարկ': ['loan', 'credit'],
        'բանկ': ['bank', 'banking'],  
        'ապահովագրություն': ['insurance'],
        'հատուցում': ['compensation', 'payment'],
        'վթար': ['accident', 'crash'],
        'քարտ': ['card'],
        'հաշիվ': ['account'],
        'տույժ': ['penalty', 'fine'],
        'պարտավորություն': ['obligation'],
        'մարում': ['payment', 'repayment']
    };
    
    Object.entries(tagKeywords).forEach(([armenianWord, englishTags]) => {
        if (text.includes(armenianWord.toLowerCase())) {
            tags.push(...englishTags);
        }
    });
    
    return [...new Set(tags)]; // Удаляем дубликаты
}

// Запускаем парсер
if (require.main === module) {
    console.log('🚀 FSM FAQ Parser начинает работу...\n');
    parseFAQFile();
    console.log('\n✅ Парсинг завершен успешно!');
}

module.exports = { parseFAQFile };