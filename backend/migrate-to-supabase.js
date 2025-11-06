// backend/migrate-to-supabase.js
const sqlite3 = require('sqlite3');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const DATABASE_PATH = process.env.DATABASE_PATH || './database.sqlite';

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://ompuxvouefyzepsyprqb.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_KEY environment variable is required');
  console.log('Please add your Supabase service role key to the .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const db = new sqlite3.Database(DATABASE_PATH, (err) => {
  if (err) {
    console.error('❌ Error opening SQLite database:', err);
    return;
  }
  console.log('📦 Connected to SQLite database for migration.');
});

const migrateTable = (tableName, transformFn) => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM ${tableName}`, [], async (err, rows) => {
      if (err) {
        return reject(new Error(`❌ Error reading from ${tableName}: ${err.message}`));
      }

      if (!rows || rows.length === 0) {
        console.log(`ℹ️  No data to migrate for ${tableName}.`);
        return resolve();
      }
      
      console.log(`📊 Found ${rows.length} rows in ${tableName}`);
      
      const dataToInsert = transformFn ? rows.map(transformFn) : rows;

      // Insert data in smaller batches to avoid timeout
      const batchSize = 100;
      for (let i = 0; i < dataToInsert.length; i += batchSize) {
        const batch = dataToInsert.slice(i, i + batchSize);
        const { error } = await supabase.from(tableName).insert(batch);

        if (error) {
          return reject(new Error(`❌ Error inserting batch into Supabase table ${tableName}: ${error.message}`));
        }
      }

      console.log(`✅ Successfully migrated ${rows.length} rows to ${tableName}.`);
      resolve();
    });
  });
};

const runMigration = async () => {
  try {
    console.log('🚀 Starting data migration from SQLite to Supabase...\n');

    // Test Supabase connection
    const { data: testData, error: testError } = await supabase.from('settings').select('count').limit(1);
    if (testError) {
      throw new Error(`❌ Failed to connect to Supabase: ${testError.message}`);
    }
    console.log('✅ Supabase connection verified\n');

    // Migrate settings
    console.log('📋 Migrating settings...');
    await migrateTable('settings');

    // Migrate agents (handle boolean conversion)
    console.log('🤖 Migrating agents...');
    await migrateTable('agents', (row) => ({
      ...row,
      is_active: Boolean(row.is_active),
    }));

    // Migrate admin_users
    console.log('👤 Migrating admin users...');
    await migrateTable('admin_users');

    console.log('\n🎉 Data migration completed successfully!');
    console.log('📊 Migration Summary:');
    
    // Show final counts
    const { data: settingsCount } = await supabase.from('settings').select('*', { count: 'exact', head: true });
    const { data: agentsCount } = await supabase.from('agents').select('*', { count: 'exact', head: true });
    const { data: usersCount } = await supabase.from('admin_users').select('*', { count: 'exact', head: true });
    
    console.log(`   - Settings: ${settingsCount?.length || 0} records`);
    console.log(`   - Agents: ${agentsCount?.length || 0} records`);
    console.log(`   - Admin Users: ${usersCount?.length || 0} records`);

  } catch (error) {
    console.error('💥 Migration failed:', error.message);
    process.exit(1);
  } finally {
    db.close((err) => {
      if (err) {
        console.error('Error closing SQLite database:', err);
      } else {
        console.log('📦 SQLite database connection closed.');
      }
    });
  }
};

runMigration();