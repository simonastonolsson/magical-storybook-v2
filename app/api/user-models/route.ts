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

  if (!body.model_path || !body.model_name || !body.trigger_word) {
    return NextResponse.json(
      { error: 'Missing required fields: model_path, model_name, trigger_word' },
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
      model_path: body.model_path,
      model_name: body.model_name,
      trigger_word: body.trigger_word,
      char_desc: body.char_desc ?? null,
      reference_image_url: body.reference_image_url ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ model: data }, { status: 201 });
}
