import { NextResponse } from 'next/server';
import Replicate from 'replicate';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: Request) {
  try {
    const { zipUrl, triggerWord } = await request.json();

    if (!zipUrl) {
      return NextResponse.json({ error: 'Missing zipUrl' }, { status: 400 });
    }

    // Vi sätter triggerordet till det som skickas med, eller defaultar till 'TOK'
    const targetTriggerWord = triggerWord || 'TOK';
    console.log(`Startar träning med triggerord: ${targetTriggerWord}`);

    // Vi startar träningen på Replicate
    const training = await replicate.trainings.create(
      'ostris',
      'flux-dev-lora-trainer',
      'e440909d0e909437e8c4e47de3064d46c30504ae376c75bef6a9022d2', // Flux Dev Trainer verson
      {
        destination: `simonastonolsson/comic-hero-${Date.now()}`,
        input: {
          input_images: zipUrl,
          steps: 1000,
          trigger_word: targetTriggerWord, // HÄR ÄR NYCKELN: Vi sätter det unika triggerordet!
          autocrop: true
        },
      }
    );

    return NextResponse.json({ trainingId: training.id });
  } catch (error) {
    console.error('Training start error:', error);
    return NextResponse.json({ error: 'Failed to start training' }, { status: 500 });
  }
}
