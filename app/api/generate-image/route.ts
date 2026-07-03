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

    // FÖREBYGG DUBBELGÅNGARE-BUGGEN
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

    // DEN ABSOLUTA SWEET SPOT-FORMLEN (Mellanläget):
    // Vi beskriver bakgrunden som en mjuk, lyxig akvarell i Ghibli-stil (för att behålla stilen från 2, 3, 4).
    // Men vi beskriver ansiktet extremt precist så att Marlons unika ansiktsdrag (mörka ögon, mörkbrunt hår, hans riktiga leende)
    // tvingas fram i teckningen. Vi sätter lora_scale till en mycket välbalanserad 0.90!
    const finalPrompt = `Cozy heartwarming 2D hand-drawn watercolor children's storybook illustration, soft pencil sketch details, beautiful muted watercolor background washes, warm pastel color palette, gentle sunlit lighting, clean elegant hand-drawn outlines. The main subject is a single, highly recognizable, detailed 2D portrait of MARLONTOK as a young boy with dark brown hair, dark eyes, his actual realistic facial features, and natural hairstyle, rendered beautifully as a tecknad 2D-figur. Placed in a cozy, soft-textured environment: ${cleanedPrompt}, high quality heartwarming 2D art, beautifully colored, warm and inviting cozy atmosphere. Avoid photo, avoid real-world photograph, avoid camera shot, avoid photorealism, avoid realistic skin textures, avoid duplicates, avoid clones, avoid chibi doll face, avoid giant circular black button eyes, avoid simplified cartoon faces, avoid plastic 3D CGI, avoid glossy renders, avoid TV-game graphics, avoid dark moody colors.`;

    console.log(`Skapar Flux-bild med den perfekta balanseringen: ${finalPrompt}`);

    const isChild = finalPrompt.toLowerCase().includes("boy") || 
                    finalPrompt.toLowerCase().includes("girl") || 
                    finalPrompt.toLowerCase().includes("child") ||
                    finalPrompt.toLowerCase().includes("baby");

    // 0.90 är den gyllene medelvägen. Det är tillräckligt högt för att Marlon ska bli porträttlik,
    // men tillräckligt lågt för att förhindra att bilden blir ett verkligt foto (som hände med Panel 1).
    const activeLoraScale = isChild ? 0.90 : 0.82;
    console.log(`Mellanläge aktivt - LoRA-skala: ${activeLoraScale} (Barn: ${isChild})`);

    const input: any = {
      prompt: finalPrompt,
      width: 1024,
      height: 768,
      num_inference_steps: 28, 
      guidance_scale: 3.0, // Svag höjning för att öka precisionen på karaktärens likhet
      
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
