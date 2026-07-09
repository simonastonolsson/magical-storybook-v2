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

  // Lets the client resume/finalize trainings that were still in progress the
  // last time this account was seen (e.g. the tab was closed or reloaded
  // mid-training) - see app/api/check-training/route.ts for how these get
  // created and finalized.
  const { data: pendingTrainings, error: pendingError } = await supabase
    .from('pending_trainings')
    .select('training_id, model_name, trigger_word, created_at')
    .eq('status', 'training')
    .order('created_at', { ascending: false });

  if (pendingError) {
    console.error('Failed to load pending trainings:', pendingError);
  }

  return NextResponse.json({ models: data, pendingTrainings: pendingTrainings || [] });
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
