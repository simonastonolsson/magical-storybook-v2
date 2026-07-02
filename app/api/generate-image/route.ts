import Replicate from 'replicate';
import { NextResponse } from 'next/server';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
  useFileOutput: false 
} as any);

export async function POST(request: Request) {
  try {
    const { prompt, trainedModelId, extraLoraId, extraLoraScale } = await request.json();

    if (!trainedModelId) {
      return NextResponse.json({ error: 'Missing trainedModelId' }, { status: 400 });
    }

    console.log(`Skapar stabil Flux LoRA-bild för prompt: ${prompt}`);

    const input: any = {
      prompt: prompt,
      width: 1024,
      height: 768,
      num_inference_steps: 28, 
      guidance_scale: 3.5,     
      
      // Vi sätter din .tar-länk som primära vikter
      lora_weights: trainedModelId,
      
      // NYCKELN: Sänkt från 1.0 till 0.8 för att ge plats åt din kropp och bakgrunden!
      lora_scale: 0.8 
    };

    // Om kompisen Baran är med sätter vi hans lora_scale till samma stabila 0.8
    if (extraLoraId) {
      input.extra_lora = extraLoraId;
      input.extra_lora_scale = extraLoraScale || 0.8;
    }

    const output = await replicate.run(
      "black-forest-labs/flux-dev-lora", 
      { input }
    );

    let finalImageUrl = "";
    if (typeof output === 'string') {
      finalImageUrl = output;
    } else if (Array.isArray(output) && output.length > 0) {
      const first = output[0];
      finalImageUrl = typeof first === 'string' ? first : (first?.url || first?.toString() || "");
    } else if (output && typeof output === 'object') {
      finalImageUrl = (output as any).url || output.toString() || "";
    }

    console.log(`Hittade bildlänk: ${finalImageUrl}`);

    if (!finalImageUrl || finalImageUrl.includes('[object')) {
      return NextResponse.json({ error: 'Image generation failed' }, { status: 500 });
    }

    return NextResponse.json({ imageUrl: finalImageUrl });

  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}
