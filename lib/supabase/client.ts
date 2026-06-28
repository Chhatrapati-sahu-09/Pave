import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const isConfigured = !!(url && url !== 'undefined' && url.trim() !== '' && anonKey && anonKey !== 'undefined' && anonKey.trim() !== '');

  const finalUrl = isConfigured ? url : 'https://dummy-project.supabase.co';
  const finalAnonKey = isConfigured ? anonKey : 'dummy-anon-key';

  return createBrowserClient(finalUrl, finalAnonKey);
}
