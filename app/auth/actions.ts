'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function getSiteUrl() {
  const headerOrigin = headers().get('origin');
  return headerOrigin || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
}

export async function signInWithEmail(formData: FormData) {
  const email = String(formData.get('email') || '').trim();
  if (!email) return { error: 'Ange en giltig e-postadress.' };

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/callback`,
    },
  });

  if (error) return { error: error.message };
  return { success: true };
}

export async function signInWithGoogle() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${getSiteUrl()}/auth/callback`,
    },
  });

  if (error || !data.url) {
    redirect('/login?error=oauth-error');
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
