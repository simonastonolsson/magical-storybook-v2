import Replicate from 'replicate';
import { NextResponse } from 'next/server';

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN } as any);

const STYLE_PROMPTS: Record<string, { positive: string; negative: string; qualityBoost: string; qualityBoostNoLighting: string; styleConsistency: string; loraScale: number; loraScaleChild: number; loraScaleSolo: number; loraScaleSoloChild: number }> = {
  digital_painting: {
    positive: "digital painted illustration, painterly art style, soft brush strokes, natural volumetric lighting, cinematic composition, detailed background environment, high quality digital painting, concept art, story illustration",
    negative: "photograph, photorealistic, DSLR, 3D CGI, Pixar, anime, chibi, flat colors, hard outlines, duplicates",
    qualityBoost: ", cinematic dramatic lighting, rich composition, vivid saturated colors, high quality detailed illustration",
    qualityBoostNoLighting: ", painterly illustrated rendering, rich composition, vivid saturated colors, high quality detailed illustration",
    styleConsistency: ", consistent painterly illustration style, uniform artistic rendering throughout",
    loraScale: 0.80,
    loraScaleChild: 0.88,
    loraScaleSolo: 0.85,
    loraScaleSoloChild: 0.93
  },
  ligne_claire: {
    positive: "ligne claire comic art style, clean precise ink outlines, flat cel colors, bright even lighting, clear readable panels, European bande dessinee style, Tintin inspired illustration, bold outlines, simple clean backgrounds",
    negative: "photograph, photorealistic, 3D CGI, anime, shading, dark shadows, watercolor, rough textures, duplicates",
    qualityBoost: ", rich detailed composition, vivid bold flat colors, high quality clean illustration",
    qualityBoostNoLighting: ", rich detailed composition, vivid bold flat colors, high quality clean illustration",
    styleConsistency: ", consistent clean-line illustration style, uniform artistic rendering throughout",
    loraScale: 0.78,
    loraScaleChild: 0.85,
    loraScaleSolo: 0.83,
    loraScaleSoloChild: 0.90
  },
  american_comic: {
    positive: "American superhero comic book art, bold ink outlines, dynamic composition, strong contrasting colors, Marvel DC style illustration, halftone dots, dramatic lighting, action comic panel, professional comic art",
    negative: "photograph, photorealistic, 3D CGI, anime, watercolor, soft colors, duplicates, blurry",
    qualityBoost: ", cinematic dramatic lighting, rich dynamic composition, vivid saturated colors, high quality detailed illustration",
    qualityBoostNoLighting: ", bold comic illustrated rendering, rich dynamic composition, vivid saturated colors, high quality detailed illustration",
    styleConsistency: ", consistent bold comic illustration style, uniform artistic rendering throughout",
    loraScale: 0.78,
    loraScaleChild: 0.85,
    loraScaleSolo: 0.83,
    loraScaleSoloChild: 0.90
  },
  watercolor: {
    positive: "cozy heartwarming 2D hand-drawn watercolor storybook illustration, soft pencil sketch details, beautiful muted watercolor washes, warm pastel color palette, gentle sunlit lighting, clean elegant hand-drawn outlines, warm and inviting cozy atmosphere",
    negative: "photograph, photorealistic, 3D CGI, Pixar, anime, chibi, hard outlines, flat digital colors, duplicates",
    qualityBoost: ", rich detailed composition, luminous glowing colors, high quality detailed illustration",
    qualityBoostNoLighting: ", rich detailed composition, luminous glowing colors, high quality detailed illustration",
    styleConsistency: ", consistent hand-painted watercolor illustration style, uniform artistic rendering throughout",
    loraScale: 0.85,
    loraScaleChild: 0.90,
    loraScaleSolo: 0.90,
    loraScaleSoloChild: 0.95
  },
  noir: {
    positive: "black and white noir comic illustration, high contrast ink drawing, dramatic shadows, cross-hatching technique, graphic novel art style, Sin City inspired, expressive ink lines, moody atmosphere, detailed pen and ink illustration",
    negative: "color, photograph, photorealistic, 3D CGI, anime, watercolor, pastel colors, duplicates",
    qualityBoost: ", dramatic high-contrast lighting, rich detailed composition, high quality detailed illustration",
    qualityBoostNoLighting: ", ink-drawn illustrated rendering, rich detailed composition, high quality detailed illustration",
    styleConsistency: ", consistent ink-drawn illustration style, uniform artistic rendering throughout",
    loraScale: 0.78,
    loraScaleChild: 0.85,
    loraScaleSolo: 0.83,
    loraScaleSoloChild: 0.90
  },
  pop_art: {
    positive: "Roy Lichtenstein pop art comic style, bold black outlines, Ben-Day dots pattern, primary flat colors, retro comic book illustration, speech bubbles style, graphic pop art panel, strong graphic design aesthetic",
    negative: "photograph, photorealistic, 3D CGI, anime, soft colors, watercolor, realistic shading, duplicates",
    qualityBoost: ", bold dynamic composition, vivid saturated colors, high quality detailed illustration",
    qualityBoostNoLighting: ", bold dynamic composition, vivid saturated colors, high quality detailed illustration",
    styleConsistency: ", consistent graphic pop art illustration style, uniform artistic rendering throughout",
    loraScale: 0.75,
    loraScaleChild: 0.82,
    loraScaleSolo: 0.80,
    loraScaleSoloChild: 0.87
  }
};

// Experiment A: when the scene's own image_prompt already establishes strong,
// color-tinted or directional lighting, don't stack a second generic "dramatic
// lighting" instruction on top of it via qualityBoost - the two independent
// lighting cues compounding is a suspected contributor to identity drift
// (e.g. hair color) in strongly lit scenes.
const intenseLightingKeywords = /\b(sunset|sunrise|golden hour|dusk|twilight|warm light|warm glow|warm glowing|dramatic light|dramatically lit|backlit|back-lit|silhouett\w*|firelight|fire light|candlelight|candle light|neon light|moonlit|moonlight|spotlight|harsh light|glowing embers|campfire|bonfire|lantern light|colou?red light(?:ing)?|stage lights?)\b/i;

export async function POST(request: Request) {
  try {
    const { prompt, trainedModelId, triggerWord, charDesc, charOutfit, bookStyle, extraLoraId, extraLoraScale, seed } = await request.json();

    console.log("generate-image request body:", { prompt, trainedModelId, triggerWord, charDesc, charOutfit, bookStyle, seed });

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

    const styleKey = bookStyle || 'digital_painting';
    const style = STYLE_PROMPTS[styleKey] || STYLE_PROMPTS['digital_painting'];

    console.log("generate-image style resolution:", { receivedBookStyle: bookStyle, resolvedStyleKey: styleKey });

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
      cleanedPrompt = cleanedPrompt.replace(/sports car|sportbil|car/gi, "vintage hand-drawn car");
    }
    if (cleanedPrompt.toLowerCase().includes("basket")) {
      cleanedPrompt = cleanedPrompt.replace(/basketball court|basketplan/gi, "outdoor court");
      cleanedPrompt = cleanedPrompt.replace(/basketball|basketboll/gi, "basketball");
    }

    const identityReinforcement = isChild
      ? ", character's exact childlike facial features and proportions preserved, do not age up"
      : ", character's exact facial features, bone structure and apparent age preserved from reference photos, do not age down or age up";

    const multiPersonKeywords = /\b(crowd|group of|several people|many people|bystanders|classmates|audience|onlookers|other (people|kids|children|students)|companions|surrounded by)\b/i;
    const backgroundDiversity = multiPersonKeywords.test(cleanedPrompt)
      ? ", background characters have diverse and varied faces, different from the protagonist, unrelated bystanders with distinct individual appearances"
      : "";

    const sceneHasIntenseLighting = intenseLightingKeywords.test(cleanedPrompt);
    const qualityBoost = sceneHasIntenseLighting ? style.qualityBoostNoLighting : style.qualityBoost;

    const finalPrompt = "Full unobstructed view of character's entire head and hair, vertical portrait framing, ample headroom, character never cropped at top of frame. " + style.positive + ". Main subject: " + characterAnchor + ", realistic facial features preserved from reference photos. Scene: " + cleanedPrompt + ". The character must wear exactly: " + finalOutfit + " in this scene, outfit must not change, protagonist's full head and hair must remain fully visible even in crowd or group scenes, do not crop the main character's head to fit background characters" + identityReinforcement + backgroundDiversity + qualityBoost + style.styleConsistency;

    // Experiment B: extraLoraId is only ever set when the companion's trigger
    // word is actually present in this prompt (see companionLoraIdForPrompt in
    // app/skapa/page.tsx), so its absence combined with no multi-person
    // keywords means this specific scene depicts the main character alone -
    // the only case where a higher lora_scale carries no leakage risk to
    // other people in frame.
    const soloSceneBoostApplied = !extraLoraId && !multiPersonKeywords.test(cleanedPrompt);
    const activeLoraScale = soloSceneBoostApplied
      ? (isChild ? style.loraScaleSoloChild : style.loraScaleSolo)
      : (isChild ? style.loraScaleChild : style.loraScale);

    console.log("Style: " + styleKey + " | Intense lighting detected: " + sceneHasIntenseLighting + " | soloSceneBoostApplied: " + soloSceneBoostApplied + " | lora_scale used: " + activeLoraScale + " | Prompt: " + finalPrompt);

    const input: any = {
      prompt: finalPrompt,
      negative_prompt: style.negative + ", wrong outfit, different clothes, clone, duplicate face, cloned face, same face repeated on multiple people, identical twins in background, multiple people with same appearance",
      width: 1024,
      height: 1152,
      num_inference_steps: 35,
      guidance_scale: 3.5,
      lora_scale: activeLoraScale
    };

    if (extraLoraId) {
      input.extra_lora = extraLoraId;
      input.extra_lora_scale = extraLoraScale || 0.8;
    }

    if (typeof seed === 'number') {
      input.seed = seed;
    }

    const output = await replicate.run(trainedModelId, { input });
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
