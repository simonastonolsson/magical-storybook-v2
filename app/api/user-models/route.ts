import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { NewUserModel } from '@/lib/models';

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('user_models')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ models: data });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body: NewUserModel = await request.json();

  if (!body.model_name || !Array.isArray(body.reference_image_urls) || body.reference_image_urls.length === 0) {
    return NextResponse.json(
      { error: 'Missing required fields: model_name, reference_image_urls' },
      { status: 400 }
    );
  }

  const { data: existing } = await supabase
    .from('user_models')
    .select('id')
    .eq('user_id', user.id)
    .ilike('model_name', body.model_name)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: 'Du har redan en karaktär som heter ' + body.model_name + ', välj ett annat namn.' },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from('user_models')
    .insert({
      user_id: user.id,
      model_name: body.model_name,
      char_desc: body.char_desc ?? null,
      // Primary source of truth going forward - all uploaded photos, not
      // just one (see the reference_image_urls text[] migration).
      reference_image_urls: body.reference_image_urls,
      // Old singular column - kept populated defensively (same reasoning as
      // model_path/trigger_word below: unknown whether it's NOT NULL, and
      // it's harmless either way) even though nothing reads it back anymore
      // now that selectCharacter reads reference_image_urls instead.
      reference_image_url: body.reference_image_urls[0],
      // model_path/trigger_word: LoRA-era NOT NULL-safe placeholders. These
      // columns are unused everywhere else in the app now - kept populated
      // only because the columns themselves haven't been dropped yet.
      model_path: 'gemini-reference-only',
      trigger_word: 'n/a',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ model: data }, { status: 201 });
}
