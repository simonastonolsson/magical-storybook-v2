import Replicate from 'replicate';
import { NextResponse } from 'next/server';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: Request) {
  try {
    const { zipUrl } = await request.json();

    if (!zipUrl) {
      return NextResponse.json({ error: 'Missing zip URL' }, { status: 400 });
    }

    // BYT UT DETTA MOT DITT ANVÄNDARNAMN PÅ REPLICATE! (t.ex. 'simonastonolsson')
    const replicateUsername = 'DITT_REPLICATE_ANVÄNDARNAMN'; 
    const modelName = 'my-custom-lora-model';
    const destinationModel = `${replicateUsername}/${modelName}` as `${string}/${string}`;

    // Vi startar träningen med Replicates officiella trainings-metod!
    const training = await replicate.trainings.create(
      "ostris",
      "flux-dev-lora-trainer",
      "e440909d3512c31646ee2e0c7d6f6f4923224863a6a10c494606e79fb5844497", // Ostris Flux Dev Trainer version
      {
        destination: destinationModel, // Här sparas din unika modell på ditt konto!
        input: {
          input_images: zipUrl,
          trigger_word: "TOK",         // Ordet vi använder i sagan för att rita dig!
          steps: 1000,
        },
      }
    );

    // Vi skickar tillbaka ID:t för själva tränings-jobbet
    return NextResponse.json({ trainingId: training.id });
    
  } catch (error) {
    console.error('Training start error:', error);
    return NextResponse.json({ error: 'Failed to start training' }, { status: 500 });
  }
}
