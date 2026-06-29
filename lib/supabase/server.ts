import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const isConfigured = !!(url && url !== 'undefined' && url.trim() !== '' && anonKey && anonKey !== 'undefined' && anonKey.trim() !== '');

  const finalUrl = isConfigured ? url.trim() : 'https://dummy-project.supabase.co';
  const finalAnonKey = isConfigured ? anonKey.trim() : 'dummy-anon-key';

  return createServerClient(
    finalUrl,
    finalAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignored during static render
          }
        },
      },
    }
  );
}
