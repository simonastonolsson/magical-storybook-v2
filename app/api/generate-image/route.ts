import Replicate from 'replicate';
import { NextResponse } from 'next/server';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
} as any);

export async function POST(request: Request) {
  try {
    const { prompt, trainedModelId, extraLoraId, extraLoraScale } = await request.json();

    if (!trainedModelId) {
      return NextResponse.json({ error: 'Missing trainedModelId' }, { status: 400 });
    }

    // TA STENHÅRT KOMMANDO ÖVER 2D-STILEN:
    // Vi rensar bort Geminis egna stil-prefix för att undvika dubbletter
    let cleanedPrompt = prompt || "";
    const stylePrefixes = [
      "Comic book panel illustration, graphic novel art,",
      "Comic book panel illustration, graphic novel art"
    ];

    for (const prefix of stylePrefixes) {
      if (cleanedPrompt.toLowerCase().startsWith(prefix.toLowerCase())) {
        cleanedPrompt = cleanedPrompt.slice(prefix.length).trim();
      }
    }
    cleanedPrompt = cleanedPrompt.replace(/^[\s,]+/, "");

    // VI SKAPAR DET ULTIMATA 2D-STIL-LÅSET:
    // Vi lägger till explicita instruktioner för platt 2D och förbjuder all form av 3D, CGI och fotorealism!
    const finalPrompt = `Comic book panel illustration, graphic novel art style, flat 2D vector colors, bold clean black ink outlines, professional comic book cell-shading, ${cleanedPrompt}, high quality 2D comic book illustration. Avoid 3D render, avoid CGI, avoid photorealism, avoid 3D digital shading, avoid realistic lighting, avoid photography, avoid octane render.`;

    console.log(`Skapar Flux-bild med stenhårt 2D-stil-lås: ${finalPrompt}`);

    const input: any = {
      prompt: finalPrompt,
      width: 1024,
      height: 768,
      num_inference_steps: 28, 
      guidance_scale: 3.5,     
      
      lora_weights: trainedModelId,
      lora_scale: 1.0 
    };

    if (extraLoraId) {
      input.extra_lora = extraLoraId;
      input.extra_lora_scale = extraLoraScale || 0.8;
    }

    const output = await replicate.run(
      "black-forest-labs/flux-dev-lora", 
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
