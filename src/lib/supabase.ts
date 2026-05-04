import { createClient } from '@supabase/supabase-js';

<<<<<<< HEAD
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;
=======
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
>>>>>>> d03fe133024be3ce9a38b07fce8d33278361eff9

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase env variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
