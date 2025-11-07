const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 20 // Max 20 files at once
  }
});

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to generate embeddings
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

// Helper function to extract text from different file types
async function extractTextFromFile(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  
  try {
    const content = await fs.readFile(filePath, 'utf8');
    
    switch (ext) {
      case '.txt':
      case '.md':
        return content;
      case '.json':
        try {
          const jsonData = JSON.parse(content);
          return JSON.stringify(jsonData, null, 2);
        } catch {
          return content;
        }
      default:
        return content; // For now, treat as text
    }
  } catch (error) {
    console.error(`Error extracting text from ${originalName}:`, error);
    throw new Error(`Failed to extract text from ${originalName}`);
  }
}

// GET /api/knowledge/documents - List all documents
router.get('/documents', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const { data, error } = await supabase
      .from('knowledge_base')
      .select('*')
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) throw error;

    res.json({ 
      success: true, 
      documents: data,
      count: data.length 
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch documents' 
    });
  }
});

// GET /api/knowledge/documents/:id - Get specific document
router.get('/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('knowledge_base')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    res.json({ 
      success: true, 
      document: data 
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch document' 
    });
  }
});

// DELETE /api/knowledge/documents/:id - Delete document
router.delete('/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('knowledge_base')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ 
      success: true, 
      message: 'Document deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete document' 
    });
  }
});

// GET /api/knowledge/stats - Get statistics about knowledge base
router.get('/stats', async (req, res) => {
  try {
    // Get total count
    const { count: totalDocuments, error: countError } = await supabase
      .from('knowledge_base')
      .select('*', { count: 'exact', head: true });

    if (countError) throw countError;

    // Get category stats
    const { data: categoryData, error: categoryError } = await supabase
      .from('knowledge_base')
      .select('category')
      .neq('category', null);

    if (categoryError) throw categoryError;

    // Get language stats
    const { data: languageData, error: languageError } = await supabase
      .from('knowledge_base')
      .select('language')
      .neq('language', null);

    if (languageError) throw languageError;

    // Process stats
    const categories = {};
    const languages = {};

    categoryData.forEach(item => {
      categories[item.category] = (categories[item.category] || 0) + 1;
    });

    languageData.forEach(item => {
      languages[item.language] = (languages[item.language] || 0) + 1;
    });

    res.json({
      success: true,
      totalDocuments: totalDocuments || 0,
      categories,
      languages
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch stats',
      totalDocuments: 0,
      categories: {},
      languages: {}
    });
  }
});

// POST /api/knowledge/upload - Upload and process files
router.post('/upload', upload.array('files'), async (req, res) => {
  const stats = {
    total: 0,
    successful: 0,
    failed: 0,
    errors: []
  };

  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded',
        stats
      });
    }

    stats.total = req.files.length;
    const companyId = process.env.DEFAULT_COMPANY_ID || 'd741629c-16e0-4009-9ced-77f406a7e6d0';

    for (const file of req.files) {
      try {
        console.log(`Processing file: ${file.originalname}`);
        
        // Extract text content
        const content = await extractTextFromFile(file.path, file.originalname);
        
        if (!content || content.trim().length === 0) {
          throw new Error('Empty file content');
        }

        // Generate embedding
        const embedding = await generateEmbedding(content);

        // Determine file properties
        const ext = path.extname(file.originalname).toLowerCase();
        const category = ext === '.json' ? 'faq' : 'document';
        const language = /[а-яё]/i.test(content) ? 'hy-AM' : 'en-US'; // Simple language detection
        
        // Create document record
        const documentData = {
          id: uuidv4(),
          company_id: companyId,
          title: path.basename(file.originalname, ext),
          content: content,
          category: category,
          subcategory: null,
          language: language,
          source_type: 'upload',
          tags: [ext.replace('.', '')],
          metadata: {
            originalFilename: file.originalname,
            fileSize: file.size,
            uploadedAt: new Date().toISOString()
          },
          embedding: embedding
        };

        // Insert into database
        const { error } = await supabase
          .from('knowledge_base')
          .insert(documentData);

        if (error) throw error;

        stats.successful++;
        console.log(`Successfully processed: ${file.originalname}`);
        
      } catch (error) {
        console.error(`Failed to process ${file.originalname}:`, error);
        stats.failed++;
        stats.errors.push(`${file.originalname}: ${error.message}`);
      } finally {
        // Clean up uploaded file
        try {
          await fs.unlink(file.path);
        } catch (unlinkError) {
          console.error('Error deleting temp file:', unlinkError);
        }
      }
    }

    res.json({
      success: true,
      message: `Processed ${stats.successful}/${stats.total} files successfully`,
      stats
    });

  } catch (error) {
    console.error('Error in upload handler:', error);
    
    // Clean up any remaining files
    if (req.files) {
      for (const file of req.files) {
        try {
          await fs.unlink(file.path);
        } catch (unlinkError) {
          // Ignore cleanup errors
        }
      }
    }

    res.status(500).json({
      success: false,
      error: 'Failed to process uploads',
      stats
    });
  }
});

// POST /api/knowledge/documents - Create single document
router.post('/documents', async (req, res) => {
  try {
    const { title, content, category, subcategory, language, source_type, tags } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: 'Title and content are required'
      });
    }

    // Generate embedding
    const embedding = await generateEmbedding(content);
    const companyId = process.env.DEFAULT_COMPANY_ID || 'd741629c-16e0-4009-9ced-77f406a7e6d0';

    const documentData = {
      id: uuidv4(),
      company_id: companyId,
      title,
      content,
      category: category || 'general',
      subcategory: subcategory || null,
      language: language || 'en-US',
      source_type: source_type || 'manual',
      tags: tags || [],
      metadata: {
        createdViaAPI: true,
        createdAt: new Date().toISOString()
      },
      embedding
    };

    const { data, error } = await supabase
      .from('knowledge_base')
      .insert(documentData)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      document: data
    });

  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create document'
    });
  }
});

module.exports = router;