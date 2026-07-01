import Replicate from 'replicate';
import { NextResponse } from 'next/server';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: Request) {
  try {
    const { prompt, trainedModelId, extraLoraId, extraLoraScale } = await request.json();

    if (!trainedModelId) {
      return NextResponse.json({ error: 'Missing trainedModelId' }, { status: 400 });
    }

    console.log(`Skapar bild med prompt: ${prompt}`);

    const input: any = {
      prompt: prompt,
      width: 1024,
      height: 768,
      num_inference_steps: 28, 
      guidance_scale: 3.5,     
      lora_scale: 1.0 
    };

    // FIXEN: Vi filtrerar bort gamla trasiga "ostris/flux-dev-lora-trainer"-ID:n från minnet!
    if (extraLoraId && !extraLoraId.includes('ostris/flux-dev-lora-trainer')) {
      let formattedLora = extraLoraId;
      // Gör om kolon till snedstreck för att passa extra_lora i Flux-motorn
      if (formattedLora.includes(':') && !formattedLora.startsWith('http')) {
        formattedLora = formattedLora.replace(':', '/');
      }
      input.extra_lora = formattedLora;
      input.extra_lora_scale = extraLoraScale || 0.8;
    }

    const output = await replicate.run(
      trainedModelId as `${string}/${string}:${string}`, 
      { input }
    );

    const finalImageUrl = Array.isArray(output) && output.length > 0 ? output[0] : null;

    if (!finalImageUrl) return NextResponse.json({ error: 'Image generation failed' }, { status: 500 });

    return NextResponse.json({ imageUrl: finalImageUrl });

  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}
