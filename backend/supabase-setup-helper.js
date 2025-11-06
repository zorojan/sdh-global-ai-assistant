/**
 * 🔑 Supabase Credentials Setup Helper
 * This script helps you configure Supabase environment variables
 */

console.log('🔑 Supabase Credentials Setup Helper\n');

console.log('📋 To fix your Supabase connection, follow these steps:\n');

console.log('1️⃣ **Get Your Supabase Credentials:**');
console.log('   🌐 Go to: https://app.supabase.com/');
console.log('   📁 Select your project (or create one if needed)');
console.log('   ⚙️  Go to: Settings → API');
console.log('   🔑 Copy the following:\n');

console.log('   📍 Project URL: https://your-project-ref.supabase.co');
console.log('   🔐 Service Role Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...\n');

console.log('2️⃣ **Update Your .env File:**');
console.log('   📝 Edit: backend/.env');
console.log('   ✏️  Replace these lines:\n');

console.log('   SUPABASE_URL=https://your-actual-project-ref.supabase.co');
console.log('   SUPABASE_SERVICE_KEY=your-actual-service-role-key-here\n');

console.log('3️⃣ **Test Your Connection:**');
console.log('   🧪 Run: node test-supabase-connection.js');
console.log('   ✅ Should show: "Supabase client: SUCCESS"\n');

console.log('🚨 **Network Issues?**');
console.log('   If you still get connection timeouts:');
console.log('   • Try different network (mobile hotspot)');
console.log('   • Check firewall settings');
console.log('   • Use VPN if in restricted network');
console.log('   • Wait and try again later\n');

console.log('💡 **Need Help?**');
console.log('   📖 Read: SUPABASE-TROUBLESHOOTING.md');
console.log('   🆘 Supabase Discord: https://discord.supabase.com/');
console.log('   📊 Status Page: https://status.supabase.com/\n');

console.log('🎯 **Quick Test Commands:**');
console.log('   Test network: ping supabase.com');
console.log('   Test backend: npm run dev');
console.log('   Test connection: node test-supabase-connection.js\n');

// Check current environment
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  console.log('📄 **Current .env Status:**');
  
  if (envContent.includes('replace-with-your-service-key')) {
    console.log('   ❌ SUPABASE_SERVICE_KEY: Not configured (placeholder value)');
  } else if (envContent.includes('SUPABASE_SERVICE_KEY=eyJ')) {
    console.log('   ✅ SUPABASE_SERVICE_KEY: Configured (starts with eyJ)');
  } else {
    console.log('   ⚠️  SUPABASE_SERVICE_KEY: Unknown format');
  }
  
  if (envContent.includes('SUPABASE_URL=https://')) {
    console.log('   ✅ SUPABASE_URL: Configured');
  } else {
    console.log('   ❌ SUPABASE_URL: Not configured');
  }
} else {
  console.log('📄 **No .env file found** - Please create one using .env.example');
}

console.log('\n🚀 Once configured, restart your backend with: npm run dev');