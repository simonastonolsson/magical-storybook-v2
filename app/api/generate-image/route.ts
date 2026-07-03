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

    // VI FÖRSTÄRKER DESIGN-STILEN (Lama-stil):
    // Vi lägger till stenhårda krav på naturliga ansiktsproportioner ("natural facial features", "finely detailed realistic eyes")
    // för att hindra att starka objekt som bilar förvandlar karaktären till en generisk 3D-docka eller Chibi.
    const finalPrompt = `Cozy hand-drawn indie graphic novel illustration style, charming heartwarming slice-of-life anime aesthetic, beautiful soft watercolor textures, warm pastel color palette, gentle sunlit lighting, clean elegant hand-drawn outlines, ${cleanedPrompt}, natural facial proportions, finely detailed eyes, authentic face expression, high quality heartwarming art, beautifully colored, warm and inviting cozy atmosphere. Avoid chibi style, avoid giant circular black button eyes, avoid simplified cartoon faces, avoid high contrast superhero comic book style, avoid bold thick black outlines, avoid flat digital vector art, avoid 3D render, avoid CGI, avoid photorealism, avoid dark moody colors.`;

    console.log(`Skapar Flux-bild med den exklusiva mysiga 2D-stilen (Lama-stil): ${finalPrompt}`);

    // DYNAMISK LIKHETS-BOOST:
    const isChild = finalPrompt.toLowerCase().includes("boy") || 
                    finalPrompt.toLowerCase().includes("girl") || 
                    finalPrompt.toLowerCase().includes("child") ||
                    finalPrompt.toLowerCase().includes("baby");

    const activeLoraScale = isChild ? 1.15 : 1.0;
    console.log(`Använder LoRA-skala: ${activeLoraScale} (Barn-boost aktiv: ${isChild})`);

    const input: any = {
      prompt: finalPrompt,
      width: 1024,
      height: 768,
      num_inference_steps: 28, 
      guidance_scale: 3.5,     
      
      lora_weights: trainedModelId,
      lora_scale: activeLoraScale
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
