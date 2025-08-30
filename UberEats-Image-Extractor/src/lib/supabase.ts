import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qgabsyggzlkcstjzugdh.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnYWJzeWdnemxrY3N0anp1Z2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NTI2OTQsImV4cCI6MjA3MTMyODY5NH0.4kSwUAw2hXVPddBSf9l7BstV9FQ_BwVQWfhvRXnUHC0';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Helper function to get current user's organization ID
export async function getCurrentUserOrgId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('organisation_id')
    .eq('id', user.id)
    .single();

  return profile?.organisation_id || null;
}