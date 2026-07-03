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

    // 1. VI FINJUSTERAR DET PERFEKTA 2D-STILLÅSET (Lama/Ghibli-estetik):
    // Vi lägger till extremt tydliga direktiv för att tvinga in ansikten i en handritad 2D-värld.
    const finalPrompt = `Heartwarming 2D hand-drawn watercolor illustration, cozy Ghibli slice-of-life anime aesthetic, beautiful soft watercolor textures, warm pastel color palette, gentle sunlit lighting, clean elegant hand-drawn outlines, ${cleanedPrompt}, high quality heartwarming 2D art, beautifully colored, warm and inviting cozy atmosphere. Avoid photo, avoid real-world photograph, avoid camera shot, avoid photorealism, avoid realistic skin textures, avoid chibi style, avoid giant circular black button eyes, avoid simplified cartoon faces, avoid high contrast superhero comic book style, avoid bold thick black outlines, avoid flat digital vector art, avoid 3D render, avoid CGI, avoid dark moody colors.`;

    console.log(`Skapar Flux-bild med perfekt stilbalansering: ${finalPrompt}`);

    // 2. EXKLUSIV LIKHETS-BALANSERING (Vågskålen mellan Stil & Likhet):
    // Vi sänker skalan något för att förhindra "fotoläckage" (att bilden blir ett riktigt foto).
    // - 0.85 för barn (Marlon-sweetspoten som ger perfekt likhet men behåller teckningsstilen).
    // - 0.80 för vuxna.
    const isChild = finalPrompt.toLowerCase().includes("boy") || 
                    finalPrompt.toLowerCase().includes("girl") || 
                    finalPrompt.toLowerCase().includes("child") ||
                    finalPrompt.toLowerCase().includes("baby");

    const activeLoraScale = isChild ? 0.85 : 0.80;
    console.log(`Balanstest - Använder LoRA-skala: ${activeLoraScale} (Barn: ${isChild})`);

    const input: any = {
      prompt: finalPrompt,
      width: 1024,
      height: 768,
      num_inference_steps: 28, 
      
      // 3. DEN GYLLENE REGELN FÖR STYLADE LORAs:
      // Vi sänker guidance_scale till 2.8 för att ge Flux mer utrymme att följa vår konstnärliga akvarellstil!
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
