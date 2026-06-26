import Replicate from 'replicate';
import { NextResponse } from 'next/server';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: Request) {
  try {
    const { prompt, trainedModelId } = await request.json();

    if (!trainedModelId) {
      return NextResponse.json({ error: 'Trained model ID is missing!' }, { status: 400 });
    }

    // trainedModelId är i formatet: "simonastonolsson/comic-hero-xxxxxx"
    const [owner, name] = trainedModelId.split('/');

    console.log(`Hämtar senaste versionen för modell: ${owner}/${name}...`);
    
    // 1. Vi frågar Replicate efter modellen för att hitta dess absolut senaste version!
    const model = await replicate.models.get(owner, name);
    const latestVersion = model.latest_version?.id;

    if (!latestVersion) {
      throw new Error(`Kunde inte hitta någon färdigtränad version för modellen ${trainedModelId}`);
    }

    const fullModelPath = `${trainedModelId}:${latestVersion}` as `${string}/${string}:${string}`;
    console.log(`Anropar bildgenerering med fullständig path: ${fullModelPath}`);

    // 2. Vi kör bildgenereringen med den exakta versionen!
    const output = await replicate.run(
      fullModelPath, 
      {
        input: {
          prompt: prompt,
          width: 1024,
          height: 768,
          num_inference_steps: 28, 
          guidance_scale: 3.5,     
          lora_scale: 1.15         
        }
      }
    );

    const finalImageUrl = Array.isArray(output) && output.length > 0 ? output[0] : null;

    if (!finalImageUrl) {
        return NextResponse.json({ error: 'Image generation failed to produce an output.' }, { status: 500 });
    }

    return NextResponse.json({ imageUrl: finalImageUrl });

  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}
