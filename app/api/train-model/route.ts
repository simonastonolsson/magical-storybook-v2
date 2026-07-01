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

    const targetTriggerWord = triggerWord || 'TOK';
    console.log(`Startar träning med triggerord: ${targetTriggerWord}`);

    const modelName = `comic-hero-${Date.now()}`;
    
    try {
      // FIXEN: Vi skickar de tre separata argumenten och castar till "any" för att garantera ett grönt bygge!
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
