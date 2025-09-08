import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

const SUPABASE_URL = "https://kqmillfrmetkjikevqvs.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxbWlsbGZybWV0a2ppa2V2cXZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MTE3NDAsImV4cCI6MjA3MjM4Nzc0MH0.wK_6DaecOCwwpiMdC0uYIUFtzGHKeY63eSzumpWMSwY";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

// Create a typed Supabase client
export const supabase = createSupabaseClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Export the Database type for use in other files
export type { Database };