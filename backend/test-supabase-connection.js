/**
 * Supabase Connection Test Script
 * Run this to test your Supabase connectivity and configuration
 */

const https = require('https');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

console.log('🧪 Testing Supabase Connection...\n');

// Test 1: Basic HTTP connectivity
function testHTTPConnectivity() {
  return new Promise((resolve, reject) => {
    console.log('1️⃣ Testing basic HTTP connectivity to Supabase...');
    
    const options = {
      hostname: 'supabase.com',
      port: 443,
      path: '/',
      method: 'GET',
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      console.log('✅ HTTP connectivity: SUCCESS');
      console.log(`   Status Code: ${res.statusCode}`);
      resolve(true);
    });

    req.on('timeout', () => {
      console.log('⏰ HTTP connectivity: TIMEOUT (10 seconds)');
      console.log('   This suggests network or firewall blocking');
      reject(new Error('Connection timeout'));
    });

    req.on('error', (error) => {
      console.log('❌ HTTP connectivity: FAILED');
      console.log(`   Error: ${error.message}`);
      reject(error);
    });

    req.setTimeout(10000);
    req.end();
  });
}

// Test 2: Environment variables check
function testEnvironmentVariables() {
  console.log('\n2️⃣ Testing environment variables...');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  
  if (!supabaseUrl) {
    console.log('❌ SUPABASE_URL is not set');
    return false;
  } else {
    console.log('✅ SUPABASE_URL is set:', supabaseUrl);
  }
  
  if (!supabaseKey) {
    console.log('❌ SUPABASE_SERVICE_KEY is not set');
    return false;
  } else {
    console.log('✅ SUPABASE_SERVICE_KEY is set: [HIDDEN]');
  }
  
  return true;
}

// Test 3: Supabase client connection
async function testSupabaseClient() {
  console.log('\n3️⃣ Testing Supabase client connection...');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.log('❌ Cannot test client: missing environment variables');
    return false;
  }
  
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Test with a simple query
    const { data, error } = await supabase
      .from('settings')
      .select('count')
      .limit(1);
      
    if (error) {
      console.log('❌ Supabase client: FAILED');
      console.log(`   Error: ${error.message}`);
      return false;
    } else {
      console.log('✅ Supabase client: SUCCESS');
      console.log('   Successfully connected to your Supabase database');
      return true;
    }
  } catch (error) {
    console.log('❌ Supabase client: FAILED');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Supabase connection tests...\n');
  
  try {
    // Test basic connectivity first
    try {
      await testHTTPConnectivity();
    } catch (error) {
      console.log('\n⚠️  Network connectivity issues detected!');
      console.log('   Possible causes:');
      console.log('   • Corporate firewall blocking HTTPS traffic');
      console.log('   • ISP network issues');
      console.log('   • Regional internet connectivity problems');
      console.log('   • Antivirus/security software blocking connections\n');
    }
    
    // Test environment variables
    const envOK = testEnvironmentVariables();
    
    if (envOK) {
      // Test Supabase client
      await testSupabaseClient();
    }
    
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
  }
  
  console.log('\n📋 Next Steps:');
  console.log('1. If HTTP connectivity failed: Check firewall/network settings');
  console.log('2. If env vars missing: Update your .env file with Supabase credentials');  
  console.log('3. If client failed: Verify your Supabase project settings');
  console.log('\n🔗 Get your Supabase credentials at: https://app.supabase.com/project/_/settings/api');
}

// Run the tests
runAllTests();