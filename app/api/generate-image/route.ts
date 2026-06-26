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

    // SLUTGILTIG MAGI: Max-optimerade inställningar för konsekventa ansikten!
    const output = await replicate.run(
      trainedModelId as `${string}/${string}`, 
      {
        input: {
          prompt: prompt,
          width: 1024,
          height: 768,
          num_inference_steps: 28, // Flux Dev kräver 28 steg för att rita detaljer som flaggor rätt!
          guidance_scale: 3.5,     // Standard för Flux Dev
          lora_scale: 1.15         // Pressar upp likheten på ditt tränade ansikte (Standard är 1.0)
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
