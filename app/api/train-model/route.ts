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

    const training = await replicate.trainings.create(
      'ostris',
      'flux-dev-lora-trainer',
      '26dce37af90b9d997eeb970d92e47de3064d46c30504ae376c75bef6a9022d2', // HÄR ÄR DEN RIKTIGA VERSIONEN!
      {
        destination: `simonastonolsson/comic-hero-${Date.now()}`,
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
