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

    // 1. FÖREBYGG DUBBELGÅNGARE-BUGGEN (Preventing Marlon Clone/Duplication):
    // Eftersom vi redan lägger till MARLONTOK i huvudprompten, rensar vi bort eventuella dubbletter 
    // av "Marlon" eller "MARLONTOK" i bakgrundsbeskrivningen (cleanedPrompt) så att han inte ritas två gånger!
    cleanedPrompt = cleanedPrompt.replace(/marlontok/gi, "");
    cleanedPrompt = cleanedPrompt.replace(/marlon/gi, "the boy");

    // INTELLIGENT KEYWORD-INTERCEPTION:
    let lowerPrompt = cleanedPrompt.toLowerCase();
    if (lowerPrompt.includes("sportbil") || lowerPrompt.includes("sports car") || lowerPrompt.includes("car")) {
      cleanedPrompt = cleanedPrompt.replace(/sports car|sportbil|car/gi, "whimsical vintage hand-drawn 2D watercolor red car");
    }
    if (lowerPrompt.includes("basket") || lowerPrompt.includes("basketball")) {
      cleanedPrompt = cleanedPrompt.replace(/basketball court|basketplan/gi, "charming rustic hand-drawn outdoor court in a grassy meadow");
      cleanedPrompt = cleanedPrompt.replace(/basketball|basketboll/gi, "charming hand-drawn watercolor basketball");
    }

    // EXKLUSIVT RECEPT FÖR BILD 1-KVALITET & NO-DUPLICATES:
    // Vi lägger till "single child", "one boy only" för att tvinga fram endast en karaktär i scenen!
    const finalPrompt = `Cozy heartwarming 2D hand-drawn watercolor children's storybook illustration, soft pencil sketch details, beautiful muted watercolor washes, warm pastel color palette, gentle sunlit lighting, clean elegant hand-drawn outlines. Main subject is a single, highly recognizable, detailed 2D portrait of MARLONTOK as a young boy with his actual realistic child facial features, authentic detailed eyes, and natural hairstyle. Placed in a cozy, soft-textured environment: ${cleanedPrompt}, high quality heartwarming 2D art, beautifully colored, warm and inviting cozy atmosphere. Avoid duplicates, avoid double characters, avoid clones, avoid sibling face, avoid chibi doll face, avoid giant circular black button eyes, avoid simplified cartoon faces, avoid plastic 3D CGI, avoid glossy renders, avoid TV-game graphics, avoid photo, avoid real-world photograph, avoid camera shot, avoid photorealism, avoid dark moody colors.`;

    console.log(`Skapar Flux-bild med Bild 1-formeln och anti-dubblett-spärr: ${finalPrompt}`);

    const isChild = finalPrompt.toLowerCase().includes("boy") || 
                    finalPrompt.toLowerCase().includes("girl") || 
                    finalPrompt.toLowerCase().includes("child") ||
                    finalPrompt.toLowerCase().includes("baby");

    // Vi sätter skalan till 0.95 vilket ger perfekt Marlonsikt utan att spilla över till foto
    const activeLoraScale = isChild ? 0.95 : 0.85;
    
    const input: any = {
      prompt: finalPrompt,
      width: 1024,
      height: 768,
      num_inference_steps: 28, 
      guidance_scale: 2.8,     
      
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
