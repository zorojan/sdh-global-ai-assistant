import express from 'express';
import { supabase } from '../database/supabase';
import { authenticateToken } from './auth';

const router = express.Router();

// Public endpoint to get API keys for frontend (no auth required)
router.get('/api-keys', async (req: any, res: express.Response) => {
  try {
    const { data: settings, error } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['gemini_api_key', 'openai_api_key']);

    if (error) {
      throw error;
    }

    // Return only API keys in a safe format
    const apiKeys: any = {};
    settings.forEach((setting: any) => {
      if (setting.key === 'gemini_api_key') {
        apiKeys.gemini = setting.value || '';
      } else if (setting.key === 'openai_api_key') {
        apiKeys.openai = setting.value || '';
      }
    });

    res.json(apiKeys);
  } catch (error) {
    console.error('Get API keys error:', error);
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

// Public endpoint for diagnostics data (no auth required, no sensitive data)
router.get('/diagnostics', async (req: any, res: express.Response) => {
  try {
    console.log('📊 Fetching diagnostics data...');
    
    // Get all settings first
    const { data: allSettings, error: allError } = await supabase
      .from('settings')
      .select('key, value');

    if (allError) {
      console.error('Error fetching all settings:', allError);
      throw allError;
    }

    console.log('📦 Found settings:', allSettings?.length || 0);

    // Filter out sensitive data
    const sensitiveKeys = ['gemini_api_key', 'openai_api_key', 'admin_password'];
    const settings = allSettings?.filter(setting => !sensitiveKeys.includes(setting.key)) || [];

    console.log('🔒 Filtered to safe settings:', settings.length);

    // Convert to diagnostics format
    const diagnosticsData: any = {};
    
    settings.forEach((setting: any) => {
      diagnosticsData[setting.key] = setting.value;
    });

    console.log('✅ Diagnostics data prepared:', Object.keys(diagnosticsData));
    res.json(diagnosticsData);
  } catch (error) {
    console.error('❌ Get diagnostics error:', error);
    res.status(500).json({ error: 'Failed to fetch diagnostics data' });
  }
});

// Get all settings
router.get('/', authenticateToken, async (req: any, res: express.Response) => {
  try {
    const { data: settings, error } = await supabase
      .from('settings')
      .select('*')
      .order('key');

    if (error) {
      throw error;
    }

    // Don't send password values in response for security
    const safeSettings = settings.map(setting => ({
      ...setting,
      value: setting.type === 'password' && setting.value ? '***hidden***' : setting.value
    }));

    res.json(safeSettings);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Get specific setting
router.get('/:key', authenticateToken, async (req: any, res: express.Response) => {
  try {
    const { key } = req.params;

    const { data: setting, error } = await supabase
      .from('settings')
      .select('*')
      .eq('key', key)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Setting not found' });
      }
      throw error;
    }

    // Don't send password values
    if (setting.type === 'password' && setting.value) {
      setting.value = '***hidden***';
    }

    res.json(setting);
  } catch (error) {
    console.error('Get setting error:', error);
    res.status(500).json({ error: 'Failed to fetch setting' });
  }
});

// Update setting
router.put('/:key', authenticateToken, async (req: any, res: express.Response) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' });
    }

    // Check if setting exists
    const { data: existing, error: checkError } = await supabase
      .from('settings')
      .select('*')
      .eq('key', key)
      .single();

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Setting not found' });
      }
      throw checkError;
    }

    // Update setting
    const { error: updateError } = await supabase
      .from('settings')
      .update({ 
        value: value,
        updated_at: new Date().toISOString()
      })
      .eq('key', key);

    if (updateError) {
      throw updateError;
    }

    res.json({ success: true, message: 'Setting updated successfully' });
  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

// Create new setting
router.post('/', authenticateToken, async (req: any, res: express.Response) => {
  try {
    const { key, value, description, type = 'string' } = req.body;

    if (!key || value === undefined) {
      return res.status(400).json({ error: 'Key and value are required' });
    }

    // Check if setting already exists
    const { data: existing } = await supabase
      .from('settings')
      .select('*')
      .eq('key', key)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Setting already exists' });
    }

    // Create setting
    const { error } = await supabase
      .from('settings')
      .insert({
        key,
        value,
        description,
        type
      });

    if (error) {
      throw error;
    }

    res.status(201).json({ success: true, message: 'Setting created successfully' });
  } catch (error) {
    console.error('Create setting error:', error);
    res.status(500).json({ error: 'Failed to create setting' });
  }
});

// Delete setting
router.delete('/:key', authenticateToken, async (req: any, res: express.Response) => {
  try {
    const { key } = req.params;

    const { error } = await supabase
      .from('settings')
      .delete()
      .eq('key', key);

    if (error) {
      throw error;
    }

    res.json({ success: true, message: 'Setting deleted successfully' });
  } catch (error) {
    console.error('Delete setting error:', error);
    res.status(500).json({ error: 'Failed to delete setting' });
  }
});

export default router;
