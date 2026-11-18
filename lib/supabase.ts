import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Attention : Les variables d'environnement Supabase (URL ou Anon Key) sont manquantes.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);