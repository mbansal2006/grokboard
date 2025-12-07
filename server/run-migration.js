import { supabase } from './supabase.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

async function checkTableExists() {
  try {
    // Try to query the table
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .limit(1);
    
    if (error) {
      if (error.code === 'PGRST116' || error.code === 'PGRST205' || error.message.includes('does not exist')) {
        return false;
      }
      throw error;
    }
    return true;
  } catch (error) {
    if (error.code === 'PGRST116' || error.code === 'PGRST205' || error.message.includes('does not exist')) {
      return false;
    }
    throw error;
  }
}

async function runMigrationSQL() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  // Read migration SQL
  const migrationPath = path.resolve(__dirname, '..', 'supabase', 'migrations', '001_create_courses_table.sql');
  const migrationSQL = await fs.readFile(migrationPath, 'utf-8');

  // Execute SQL using Supabase REST API
  // Note: Supabase doesn't expose a direct SQL execution endpoint through the JS client
  // We need to use the Management API or PostgREST RPC
  // For now, we'll use the REST API with rpc call or direct SQL endpoint
  
  // Extract project ref from URL
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  if (!projectRef) {
    throw new Error('Could not extract project ref from SUPABASE_URL');
  }

  // Use the Supabase REST API to execute SQL
  // This requires the Management API or we can use PostgREST's rpc
  // Actually, the simplest way is to use Supabase's SQL execution endpoint
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ sql: migrationSQL }),
  });

  if (!response.ok) {
    // If rpc doesn't work, try alternative approach
    // Supabase doesn't expose direct SQL execution for security
    // We need to use the dashboard or CLI
    throw new Error(`SQL execution not available via API. Status: ${response.status}`);
  }

  return await response.json();
}

async function runMigration() {
  console.log('🔍 Checking if courses table exists...');
  
  if (!supabase) {
    console.error('❌ Supabase is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file');
    process.exit(1);
  }

  try {
    const tableExists = await checkTableExists();
    
    if (tableExists) {
      console.log('✅ Courses table already exists!');
      return;
    }

    console.log('❌ Courses table does not exist.');
    console.log('\n📋 To create the table, please run the SQL migration:\n');
    
    // Read and display the migration SQL
    const migrationPath = path.resolve(__dirname, '..', 'supabase', 'migrations', '001_create_courses_table.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf-8');
    
    console.log('Option 1: Run SQL in Supabase Dashboard (Easiest)');
    console.log('1. Go to: https://supabase.com/dashboard/project/_/sql');
    console.log('2. Click "New Query"');
    console.log('3. Copy and paste the SQL below');
    console.log('4. Click "Run" (or press Cmd/Ctrl + Enter)\n');
    
    console.log('─'.repeat(70));
    console.log(migrationSQL);
    console.log('─'.repeat(70));
    console.log('\n');
    
    console.log('Option 2: Use Supabase CLI');
    console.log('1. Install: npm install -g supabase');
    console.log('2. Link: supabase link --project-ref YOUR_PROJECT_REF');
    console.log('3. Push: supabase db push\n');
    
    console.log('After running the migration, restart your server and try again.');
    
    process.exit(1);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    process.exit(1);
  }
}

runMigration();
