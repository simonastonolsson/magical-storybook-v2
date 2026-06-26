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

    const replicateUsername = 'simonastonolsson'; 
    
    // 1. Skapa ett helt unikt namn för varje gång vi tränar! (t.ex. comic-hero-171891000000)
    const modelName = `comic-hero-${Date.now()}`;
    const destinationModel = `${replicateUsername}/${modelName}` as `${string}/${string}`;

    // 2. MAGIN: Vi ber Replicate att först SKAPA den tomma modellen på ditt konto!
    console.log(`Skapar ny modell på Replicate: ${destinationModel}...`);
    await replicate.models.create(
      replicateUsername,
      modelName,
      {
        visibility: "private", // Håll modellen privat så bara du kan använda den
        hardware: "gpu-t4",    // Standardhårdvara
        description: "My custom trained comic book character"
      }
    );

    // 3. Nu när "behållaren" finns, startar vi träningen och säger åt den att sparas i behållaren!
    console.log(`Startar träning för: ${destinationModel}...`);
    const training = await replicate.trainings.create(
      "ostris",
      "flux-dev-lora-trainer",
      "e440909d3512c31646ee2e0c7d6f6f4923224863a6a10c494606e79fb5844497",
      {
        destination: destinationModel,
        input: {
          input_images: zipUrl,
          trigger_word: "TOK", // Vårt hemliga ord för att framkalla ansiktet!
          steps: 1000,
        },
      }
    );

    return NextResponse.json({ trainingId: training.id });
    
  } catch (error) {
    console.error('Training start error:', error);
    return NextResponse.json({ error: 'Failed to start training' }, { status: 500 });
  }
}
