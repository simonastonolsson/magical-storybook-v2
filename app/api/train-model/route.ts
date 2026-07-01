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

    // HÄR ÄR DEN MAGISKA LÖSNINGEN:
    // Vi skapar modellen först så att destinationen garanterat existerar på Replicate!
    const modelName = `comic-hero-${Date.now()}`;
    
    try {
      await replicate.models.create({
        owner: 'simonastonolsson',
        name: modelName,
        visibility: 'private',
        hardware: 'cpu' // cpu räcker eftersom det bara är en behållare för lora-vikterna
      });
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
