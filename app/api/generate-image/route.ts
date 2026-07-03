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

    // VI FINJUSTERAR DET PERFEKTA 2D-STILLÅSET:
    // Vi beskriver bakgrunderna och dinosaurierna med Ghibli-akvarell,
    // men vi kräver en stark och tydlig 2D-porträttering av MARLONTOK med hans verkliga ansiktsdrag!
    const finalPrompt = `Cozy heartwarming 2D hand-drawn watercolor illustration, cozy Ghibli slice-of-life anime aesthetic. Main subject is a highly recognizable 2D drawing of MARLONTOK, showing his actual facial features, authentic eyes, and natural hairstyle. Beautiful soft watercolor background textures, warm pastel color palette, gentle sunlit lighting, clean elegant hand-drawn outlines, ${cleanedPrompt}, high quality heartwarming 2D art, beautifully colored, warm and inviting cozy atmosphere. Avoid generic cartoon face, avoid doll face, avoid round chibi faces, avoid photo, avoid real-world photograph, avoid camera shot, avoid photorealism, avoid realistic skin textures, avoid 3D render, avoid CGI.`;

    console.log(`Skapar Flux-bild med perfekt likhet och Ghibli-stil: ${finalPrompt}`);

    // DYNAMISK LIKHETS-BOOST (SaaS-Guldstandard):
    // Vi höjer skalan till 0.98 för barn för att tvinga fram Marlons unika ansikte,
    // men håller kvar den konstnärliga friheten (guidance_scale 2.8) så att bakgrunden förblir akvarell!
    const isChild = finalPrompt.toLowerCase().includes("boy") || 
                    finalPrompt.toLowerCase().includes("girl") || 
                    finalPrompt.toLowerCase().includes("child") ||
                    finalPrompt.toLowerCase().includes("baby");

    const activeLoraScale = isChild ? 0.98 : 0.85;
    console.log(`Balanstest - Använder LoRA-skala: ${activeLoraScale} (Barn: ${isChild})`);

    const input: any = {
      prompt: finalPrompt,
      width: 1024,
      height: 768,
      num_inference_steps: 28, 
      guidance_scale: 2.8, // Behåll det mjuka konstnärliga uttrycket för bakgrunden     
      
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
