import Replicate from 'replicate';
import { NextResponse } from 'next/server';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: Request) {
  try {
    const { prompt, trainedModelId } = await request.json();

    if (!trainedModelId) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    const output = await replicate.run(
      trainedModelId as `${string}/${string}:${string}`, 
      {
        input: {
          prompt: prompt,
          width: 1024,
          height: 768,
          num_inference_steps: 28, 
          guidance_scale: 3.5,     
          lora_scale: 1.1         // Den gyllene medelvägen! Starkt ansikte utan att bli överstyrd.
        }
      }
    );

    const finalImageUrl = Array.isArray(output) && output.length > 0 ? output[0] : null;
    if (!finalImageUrl) return NextResponse.json({ error: 'Failed' }, { status: 500 });
    return NextResponse.json({ imageUrl: finalImageUrl });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
