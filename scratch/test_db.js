import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing environment variables!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log("--- FETCHING RIDERS FROM DB ---");
  const { data: riders, error: fetchError } = await supabase
    .from('riders')
    .select('id, name, email, wallet_balance, total_trips');
  
  if (fetchError) {
    console.error("Fetch error:", fetchError);
    return;
  }
  
  console.table(riders);

  if (riders && riders.length > 0) {
    const target = riders[0];
    console.log(`\nTrying to update rider ${target.id} (${target.name}) balance by 1...`);
    const newBalance = (Number(target.wallet_balance) || 0) + 1;
    
    const { data: updated, error: updateError, count } = await supabase
      .from('riders')
      .update({ wallet_balance: newBalance })
      .eq('id', target.id)
      .select();
      
    if (updateError) {
      console.error("Update error:", updateError);
    } else {
      console.log("Update success! Returned payload:", updated);
    }
  }
}

test();
