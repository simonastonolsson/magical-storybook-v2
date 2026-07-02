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

    // TA KONTROLL ÖVER STILEN (Proaktiv affärsåtgärd för 100% röd tråd):
    // Vi rensar bort eventuella gamla stilar och injicerar stenhårda färg- och seriestils-ankare.
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
    cleanedPrompt = cleanedPrompt.replace(/^[\s,]+/, ""); // Ta bort överflödiga kommatecken

    // Vi sätter samman den slutgiltiga, skottsäkra prompten med stenhård stilkontroll
    const finalPrompt = `Comic book panel illustration, graphic novel art, full color, vibrant comic book color palette, clean outlines, sharp ink lines, professional comic book coloring, ${cleanedPrompt}, high quality comic book illustration, color ink art. Avoid black and white, avoid monochrome, avoid photorealism, avoid desaturated colors.`;

    console.log(`Skapar officiell Flux LoRA-bild med stenhård stil-kontroll: ${finalPrompt}`);

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
