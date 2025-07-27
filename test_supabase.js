// test_supabase.js - Test Supabase connection
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_API_KEY = process.env.SUPABASE_API_KEY;

console.log('Testing Supabase connection...');
console.log('URL:', SUPABASE_URL ? 'Set' : 'Missing');
console.log('API Key:', SUPABASE_API_KEY ? 'Set' : 'Missing');

if (!SUPABASE_URL || !SUPABASE_API_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_API_KEY);

async function testConnection() {
  try {
    console.log('🔗 Testing connection...');
    
    // Try a simple query
    const { data, error } = await supabase
      .from('bridged_events')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Supabase error:', error);
    } else {
      console.log('✅ Supabase connection successful!');
      console.log('Data:', data);
    }
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
  }
}

testConnection(); 