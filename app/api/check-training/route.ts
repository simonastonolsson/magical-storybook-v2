import { NextResponse } from 'next/server';
import Replicate from 'replicate';
import { createClient } from '@/lib/supabase/server';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

async function insertUserModelWithDisambiguation(supabase: any, userId: string, pending: any, modelPath: string) {
  const { data: existing } = await supabase
    .from('user_models')
    .select('id')
    .eq('user_id', userId)
    .ilike('model_name', pending.model_name)
    .maybeSingle();

  // Finalization happens server-side with no user present to show a rename
  // prompt to, so disambiguate instead of dropping a succeeded (and already
  // paid-for, time-consuming) training on the floor.
  const finalName = existing ? `${pending.model_name} (${pending.trigger_word})` : pending.model_name;

  const { data, error } = await supabase
    .from('user_models')
    .insert({
      user_id: userId,
      model_path: modelPath,
      model_name: finalName,
      trigger_word: pending.trigger_word,
      char_desc: pending.char_desc,
      reference_image_url: pending.reference_image_url,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing training ID' }, { status: 400 });
  }

  try {
    const training = (await replicate.trainings.get(id)) as any;
    console.log("Training status:", training.status);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // pending_trainings rows only exist for main-character trainings (see
    // train-model/route.ts) - companion trainings, and any training started
    // before this feature existed, have no row here and fall through to the
    // plain status/fullPath response below, unchanged from before.
    let pending: any = null;
    if (user) {
      const { data } = await supabase
        .from('pending_trainings')
        .select('*')
        .eq('training_id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      pending = data;
    }

    if (training.status === 'succeeded') {
      const weightsUrl = training.output?.weights || null;

      // destination + output.version (owner/model:version) is the only valid
      // model reference for replicate.run() in generate-image/route.ts.
      // weightsUrl is a raw .tar weights file - never a valid model reference.
      if (!training.destination || !training.output?.version) {
        console.error(
          'Training succeeded but destination/output.version missing from Replicate response. Full training.output:',
          JSON.stringify(training.output)
        );
        if (pending && pending.status === 'training') {
          await supabase.from('pending_trainings')
            .update({ status: 'failed', error: 'destination/version missing from Replicate response', updated_at: new Date().toISOString() })
            .eq('id', pending.id)
            .eq('status', 'training');
        }
        return NextResponse.json({
          status: 'failed',
          error: 'Training succeeded but destination/version missing from Replicate response',
        }, { status: 500 });
      }

      const fullPath = `${training.destination}:${training.output.version}`;

      if (!pending) {
        return NextResponse.json({ status: 'succeeded', fullPath, weights: weightsUrl });
      }

      if (pending.status === 'succeeded') {
        // Already finalized by an earlier call (this tab or another) - return
        // the same result again instead of re-inserting into user_models.
        let model = null;
        if (pending.user_model_id) {
          const { data: existingModel } = await supabase.from('user_models').select('*').eq('id', pending.user_model_id).maybeSingle();
          model = existingModel;
        }
        return NextResponse.json({ status: 'succeeded', fullPath: pending.model_path || fullPath, weights: weightsUrl, model });
      }

      // Atomically claim the training -> succeeded transition so exactly one
      // caller (whichever tab/request/page-load gets here first) does the
      // user_models insert, no matter how many end up polling at once.
      const { data: claimed } = await supabase
        .from('pending_trainings')
        .update({ status: 'succeeded', model_path: fullPath, updated_at: new Date().toISOString() })
        .eq('id', pending.id)
        .eq('status', 'training')
        .select()
        .maybeSingle();

      if (!claimed) {
        // Someone else won the race between our SELECT above and this UPDATE
        // - re-fetch and return their result instead of inserting a duplicate.
        const { data: latest } = await supabase.from('pending_trainings').select('*').eq('id', pending.id).maybeSingle();
        let model = null;
        if (latest?.user_model_id) {
          const { data: existingModel } = await supabase.from('user_models').select('*').eq('id', latest.user_model_id).maybeSingle();
          model = existingModel;
        }
        return NextResponse.json({ status: 'succeeded', fullPath: latest?.model_path || fullPath, weights: weightsUrl, model });
      }

      const model = await insertUserModelWithDisambiguation(supabase, user!.id, pending, fullPath);
      await supabase.from('pending_trainings').update({ user_model_id: model.id }).eq('id', pending.id);

      return NextResponse.json({ status: 'succeeded', fullPath, weights: weightsUrl, model });
    }

    if (training.status === 'failed' || training.status === 'canceled') {
      if (pending && pending.status === 'training') {
        await supabase.from('pending_trainings')
          .update({ status: 'failed', error: 'Training ' + training.status + ' on Replicate', updated_at: new Date().toISOString() })
          .eq('id', pending.id)
          .eq('status', 'training');
      }
    }

    return NextResponse.json({ status: training.status });
  } catch (error) {
    console.error('Check training error:', error);
    return NextResponse.json({ error: 'Failed to check training status' }, { status: 500 });
  }
}
