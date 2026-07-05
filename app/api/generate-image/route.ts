import Replicate from 'replicate';
import { NextResponse } from 'next/server';

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN } as any);

export async function POST(request: Request) {
  try {
    const { prompt, trainedModelId, triggerWord, charDesc, extraLoraId, extraLoraScale } = await request.json();

    if (!trainedModelId) {
      return NextResponse.json({ error: 'Missing trainedModelId' }, { status: 400 });
    }

    const isChild = charDesc?.toLowerCase().includes("boy") ||
                    charDesc?.toLowerCase().includes("girl") ||
                    charDesc?.toLowerCase().includes("child") ||
                    charDesc?.toLowerCase().includes("baby");

    const signatureOutfit = isChild
      ? "wearing a cozy yellow raincoat and blue denim jeans"
      : "wearing a classic navy blue sweater and dark grey trousers";

    const characterAnchor = `${triggerWord || 'TOK'}, ${charDesc || 'a person'}, ${signatureOutfit}`;

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
        cleanedPrompt = cleanedPrompt.replace(triggerRegex, (match) => {
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

    const finalPrompt = "Cozy 2D hand-drawn watercolor storybook illustration, soft pencil sketch details, warm pastel colors, gentle sunlit lighting. Main subject: highly recognizable portrait of " + characterAnchor + ", natural realistic facial features, actual hair color and eye color from training photos. Scene: " + cleanedPrompt + ". Avoid: blue eyes, anime face, chibi, 3D CGI, photorealism, duplicates, clones.";

    console.log("Generating image:", finalPrompt);

    const input: any = {
      prompt: finalPrompt,
      width: 1024,
      height: 768,
      num_inference_steps: 32,
      guidance_scale: 4.0,
      lora_weights: trainedModelId,
      lora_scale: isChild ? 0.92 : 0.85
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
