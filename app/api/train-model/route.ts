import { NextResponse } from 'next/server';
import Replicate from 'replicate';
import { createClient } from '@/lib/supabase/server';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: Request) {
  try {
    const { zipUrl, triggerWord, characterName, charDesc, referenceImageUrl } = await request.json();

    if (!zipUrl) {
      return NextResponse.json({ error: 'Missing zipUrl' }, { status: 400 });
    }

    // characterName is only sent for main-character training (not companion
    // training - see startTrainingJob in app/skapa/page.tsx), which is what
    // gates whether a pending_trainings row gets created below. Companion
    // trainings intentionally keep their pre-existing behavior (no DB
    // persistence, localStorage only) - out of scope for this fix.
    let userId: string | null = null;
    if (characterName) {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }
      userId = user.id;
    }

    const targetTriggerWord = triggerWord || 'TOK';
    console.log(`Startar träning med triggerord: ${targetTriggerWord}`);

    const modelName = `comic-hero-${Date.now()}`;
    
    try {
      await (replicate.models as any).create(
        'simonastonolsson',
        modelName,
        {
          visibility: 'private',
          hardware: 'cpu'
        }
      );
      console.log(`Skapade modellen på Replicate: simonastonolsson/${modelName}`);
    } catch (createError) {
      console.error('Kunde inte skapa modell automatiskt, försöker köra träning ändå:', createError);
    }

    const training = await replicate.trainings.create(
      'ostris',
      'flux-dev-lora-trainer',
      '26dce37af90b9d997eeb970d92e47de3064d46c300504ae376c75bef6a9022d2',
      {
        destination: `simonastonolsson/${modelName}`,
        input: {
          input_images: zipUrl,
          steps: 1000,
          trigger_word: targetTriggerWord,
          
          // HÄR ÄR DEN MAGISKA LÖSNINGEN:
          // Vi stänger av autocrop helt! Detta gör att AI:n behåller din naturliga inramning
          // och lär sig rita dig med perfekt hår, axlar och tillräckligt med luft ovanför huvudet.
          autocrop: false
        },
      }
    );

    if (userId) {
      const supabase = createClient();
      const { error: pendingError } = await supabase.from('pending_trainings').insert({
        user_id: userId,
        training_id: training.id,
        trigger_word: targetTriggerWord,
        model_name: characterName,
        char_desc: charDesc ?? null,
        reference_image_url: referenceImageUrl ?? null,
      });
      if (pendingError) {
        // Not fatal to the training itself (it's already running on Replicate),
        // but means this training can't be resumed/auto-finalized if the tab
        // closes - log loudly so it's visible.
        console.error('Failed to save pending_trainings row:', pendingError);
      }
    }

    return NextResponse.json({ trainingId: training.id });
  } catch (error) {
    console.error('Training start error:', error);
    return NextResponse.json({ error: 'Failed to start training' }, { status: 500 });
  }
}
