import Replicate from 'replicate';
import { NextResponse } from 'next/server';

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN } as any);

export async function POST(request: Request) {
  try {
    const { prompt, trainedModelId, triggerWord, charDesc, charOutfit, extraLoraId, extraLoraScale } = await request.json();

    if (!trainedModelId) {
      return NextResponse.json({ error: 'Missing trainedModelId' }, { status: 400 });
    }

    const isChild = charDesc?.toLowerCase().includes("boy") ||
                    charDesc?.toLowerCase().includes("girl") ||
                    charDesc?.toLowerCase().includes("child") ||
                    charDesc?.toLowerCase().includes("baby");

    const defaultOutfit = isChild
      ? "wearing a cozy yellow raincoat and blue denim jeans"
      : "wearing a classic navy blue crew-neck sweater with round neckline and dark grey trousers";

    const finalOutfit = charOutfit ? "wearing " + charOutfit : defaultOutfit;

    const characterAnchor = (triggerWord || 'TOK') + ', ' + (charDesc || 'a person') + ', ' + finalOutfit;

    let cleanedPrompt = prompt || "";

    const stylePrefix = "Comic book panel illustration, graphic novel art,";
    if (cleanedPrompt.toLowerCase().startsWith(stylePrefix.toLowerCase())) {
      cleanedPrompt = cleanedPrompt.slice(stylePrefix.length).trim();
    }
    cleanedPrompt = cleanedPrompt.replace(/^[\s,]+/, "");

    if (triggerWord) {
      const triggerRegex = new RegExp(triggerWord, 'gi');
      const matches = cleanedPrompt.match(triggerRegex) || [];
      if (matches.length > 1) {
        let count = 0;
        cleanedPrompt = cleanedPrompt.replace(triggerRegex, (match: string) => {
          count++;
          return count === 1 ? match : "the character";
        });
      }
    }

    if (cleanedPrompt.toLowerCase().includes("car")) {
      cleanedPrompt = cleanedPrompt.replace(/sports car|sportbil|car/gi, "whimsical vintage hand-drawn 2D watercolor car");
    }
    if (cleanedPrompt.toLowerCase().includes("basket")) {
      cleanedPrompt = cleanedPrompt.replace(/basketball court|basketplan/gi, "charming hand-drawn outdoor court");
      cleanedPrompt = cleanedPrompt.replace(/basketball|basketboll/gi, "hand-drawn watercolor basketball");
    }

    const finalPrompt = "Digital painted illustration, painterly art style, " +
      "soft brush strokes, natural volumetric lighting, cinematic composition, " +
      "detailed background environment, illustrated but NOT a photograph. " +
      "Main subject: " + characterAnchor + ", realistic facial features preserved from reference, " +
      "painted in warm natural light. Scene: " + cleanedPrompt + ". " +
      "Style: high quality digital painting, concept art, story illustration. " +
      "The character must wear exactly: " + finalOutfit + " in this scene, outfit must not change.";

    console.log("Generating image:", finalPrompt);

    const input: any = {
      prompt: finalPrompt,
      negative_prompt: "photograph, photorealistic, camera shot, DSLR, 3D CGI, Pixar, anime, chibi, duplicate person, clone, blurry, hard black outlines, flat colors, wrong outfit, different clothes",
      width: 1024,
      height: 768,
      num_inference_steps: 35,
      guidance_scale: 3.5,
      lora_weights: trainedModelId,
      lora_scale: isChild ? 0.88 : 0.80
    };

    if (extraLoraId) {
      input.extra_lora = extraLoraId;
      input.extra_lora_scale = extraLoraScale || 0.8;
    }

    const output = await replicate.run("black-forest-labs/flux-dev-lora", { input });

    const finalImageUrl = Array.isArray(output) && output.length > 0 ? output[0] : null;

    if (!finalImageUrl) {
      return NextResponse.json({ error: 'Image generation failed' }, { status: 500 });
    }

    return NextResponse.json({ imageUrl: finalImageUrl });

  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}
