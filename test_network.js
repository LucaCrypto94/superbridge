// test_network.js - Test network connectivity
const https = require('https');

async function testConnection(url) {
  return new Promise((resolve) => {
    const req = https.get(url, (res) => {
      console.log(`✅ ${url} - Status: ${res.statusCode}`);
      resolve(true);
    });
    
    req.on('error', (err) => {
      console.log(`❌ ${url} - Error: ${err.message}`);
      resolve(false);
    });
    
    req.setTimeout(5000, () => {
      console.log(`⏰ ${url} - Timeout`);
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  console.log('🌐 Testing network connectivity...');
  
  // Test basic internet
  await testConnection('https://www.google.com');
  
  // Test Supabase (if you have the URL)
  const supabaseUrl = process.env.SUPABASE_URL;
  if (supabaseUrl) {
    console.log(`Testing Supabase URL: ${supabaseUrl}`);
    await testConnection(supabaseUrl);
  } else {
    console.log('No SUPABASE_URL found in environment');
  }
  
  // Test other services
  await testConnection('https://api.github.com');
}

main(); 