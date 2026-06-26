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

    // Vi skickar prompten precis som den är (utan att klistra in TOK i början av meningen).
    // Detta förhindrar helt att AI:n blandar ihop ditt ansikte med djuren (pingvinerna) i scenen!
    console.log(`Skapar bild med ren prompt: ${prompt}`);

    const output = await replicate.run(
      trainedModelId as `${string}/${string}:${string}`, 
      {
        input: {
          prompt: prompt,
          width: 1024,
          height: 768,
          num_inference_steps: 28, 
          guidance_scale: 3.5,     // Standard för mjuka, naturliga och vackra bilder
          lora_scale: 0.85         // Sänkt till 0.85! Detta gör att du ser ung, mjuk och naturlig ut igen.
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
