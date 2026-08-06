import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://okdfmpzgxeijwzuukjpj.supabase.co";
const supabaseAnonKey = "sb_publishable_ZJWdQ1F7J7LRycsBUF2e2A__wTZWUFX";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
