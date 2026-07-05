import { NextResponse } from 'next/server';
import * as fal from '@fal-ai/serverless-client';

fal.config({ credentials: process.env.FAL_KEY });

export async function POST(request: Request) {
  try {
    const {
      prompt,
      trainedModelId,
      triggerWord,
      charDesc,
      referenceImageUrl,
      extraLoraId,
      extraLoraScale
    } = await request.json();

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

    const characterAnchor = (triggerWord || 'TOK') + ', ' + (charDesc || 'a person') + ', ' + signatureOutfit;

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
      "Negative: photorealism, DSLR photo, 3D CGI, anime, chibi, flat colors, hard outlines, duplicates.";

    const loras: any[] = [
      {
        path: trainedModelId,
        scale: isChild ? 0.88 : 0.80
      }
    ];

    if (extraLoraId) {
      loras.push({ path: extraLoraId, scale: extraLoraScale || 0.8 });
    }

    const falInput: any = {
      prompt: finalPrompt,
      negative_prompt: "photograph, photorealistic, camera shot, DSLR, 3D CGI, Pixar, anime, chibi, duplicate person, clone, blurry, hard black outlines, flat colors",
      image_size: { width: 1024, height: 768 },
      num_inference_steps: 35,
      guidance_scale: 3.5,
      loras: loras,
      num_images: 1,
      enable_safety_checker: false
    };

    if (referenceImageUrl) {
      falInput.ip_adapter = [
        {
          image_url: referenceImageUrl,
          scale: 0.7,
          model_type: "ip-adapter-faceid-plusv2"
        }
      ];
    }

    const result: any = await fal.subscribe("fal-ai/flux-lora", {
      input: falInput,
      logs: true
    });

    const finalImageUrl = result?.images?.[0]?.url || null;

    if (!finalImageUrl) {
      return NextResponse.json({ error: 'Image generation failed' }, { status: 500 });
    }

    return NextResponse.json({ imageUrl: finalImageUrl });

  } catch (error) {
    console.error('Fal image generation error:', error);
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}
