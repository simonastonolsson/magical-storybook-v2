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

    // Eftersom hemsidan nu skickar med den fullständiga vägen (med versionen inbakad), 
    // kan vi rita bilden omedelbart och säkert!
    console.log(`Anropar bildgenerering för modell: ${trainedModelId}`);
    
    const output = await replicate.run(
      trainedModelId as `${string}/${string}:${string}`, 
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
