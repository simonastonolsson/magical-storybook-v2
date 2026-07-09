import Replicate from 'replicate';
import { NextResponse } from 'next/server';

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN } as any);

const STYLE_PROMPTS: Record<string, { positive: string; negative: string; qualityBoost: string; qualityBoostNoLighting: string; styleConsistency: string; loraScale: number; loraScaleChild: number; loraScaleSolo: number; loraScaleSoloChild: number; loraScaleCrowd: number; loraScaleCrowdChild: number }> = {
  digital_painting: {
    positive: "digital painted illustration, painterly art style, soft brush strokes, natural volumetric lighting, cinematic composition, detailed background environment, high quality digital painting, concept art, story illustration",
    negative: "photograph, photorealistic, DSLR, 3D CGI, Pixar, anime, chibi, flat colors, hard outlines, duplicates",
    qualityBoost: ", cinematic dramatic lighting, rich composition, vivid saturated colors, high quality detailed illustration",
    qualityBoostNoLighting: ", painterly illustrated rendering, rich composition, vivid saturated colors, high quality detailed illustration",
    styleConsistency: ", consistent painterly illustration style, uniform artistic rendering throughout",
    loraScale: 0.80,
    loraScaleChild: 0.88,
    loraScaleSolo: 0.85,
    loraScaleSoloChild: 0.93,
    loraScaleCrowd: 0.83,
    loraScaleCrowdChild: 0.91
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
    loraScaleSoloChild: 0.90,
    loraScaleCrowd: 0.81,
    loraScaleCrowdChild: 0.88
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
    loraScaleSoloChild: 0.90,
    loraScaleCrowd: 0.81,
    loraScaleCrowdChild: 0.88
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
    loraScaleSoloChild: 0.95,
    loraScaleCrowd: 0.88,
    loraScaleCrowdChild: 0.93
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
    loraScaleSoloChild: 0.90,
    loraScaleCrowd: 0.81,
    loraScaleCrowdChild: 0.88
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
    loraScaleSoloChild: 0.87,
    loraScaleCrowd: 0.78,
    loraScaleCrowdChild: 0.85
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

    // Experiment J follow-up: "Main subject: " + characterAnchor (added below)
    // is now the sole intended mention of the trigger word in the whole
    // finalPrompt. Any occurrence still inside cleanedPrompt (Gemini's own
    // image_prompt, which CLONE PREVENTION requires to contain it exactly
    // once) is now a second, redundant mention - previously adjacent to the
    // "Main subject:" one, now separated from it by the framing sentence and
    // the entire style.positive block after the reordering. Strip every
    // occurrence here, not just extras beyond the first.
    if (triggerWord) {
      const triggerRegex = new RegExp(triggerWord, 'gi');
      cleanedPrompt = cleanedPrompt.replace(triggerRegex, "the character");
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

    // Widened after a confirmed miss: a hockey scene ("teammates", "other
    // players", "spectators", "stands") matched none of the original narrow
    // list, so the scene was wrongly classified as solo and got the
    // experiment-B lora_scale boost, leaking the main character's face onto
    // background teammates/spectators. Deliberately broad - better to miss a
    // boost opportunity than to risk leakage again.
    const multiPersonKeywords = /\b(crowd|crowds|spectator|spectators|audience|bystanders|onlookers|classmates|teammates|team-mates|team mates|players|other players|opposing team|opponents|skaters|other skaters|athletes|competitors|racers|dancers|singers|passengers|customers|guests|coworkers|colleagues|siblings|friends|family members|fans|cheering|stands|bleachers|stadium|arena|rink full of|group of|groups of|several people|many people|lots of people|dozens of|hundreds of|everyone|everybody|whole team|entire team|full team|packed (stands|arena|rink)|other (people|kids|children|students|players|skaters|athletes|teammates|racers|dancers|competitors)|companions|surrounded by|background characters|watching crowd|people watching)\b/i;
    const hasMultiplePeople = multiPersonKeywords.test(cleanedPrompt);
    const backgroundDiversity = hasMultiplePeople
      ? ", background characters have diverse and varied faces, different from the protagonist, unrelated bystanders with distinct individual appearances"
      : "";

    // Experiment F: multiPersonKeywords targets crowds/groups, but a single
    // named secondary character in close interaction with the main character
    // (e.g. "the student receiving the book") matched none of those group
    // words, so such scenes still got the solo lora_scale boost and leaked
    // the main character's face onto that one other person. Separate,
    // deliberately broad check for ANY other human role mentioned, singular
    // or plural - independent of multiPersonKeywords/backgroundDiversity so
    // neither one's future changes affect the other. Known limitation: this
    // is keyword matching, not language understanding, so a pronoun-only
    // reference ("he handed her a gift") with no role noun isn't caught.
    const secondaryPersonKeywords = /\b(student|classmate|colleague|coworker|co-worker|teammate|friend|sibling|neighbor|neighbour|stranger|passerby|passer-by|visitor|guest|customer|client|patient|admirer|rival|opponent|librarian|teacher|doctor|nurse|waiter|waitress|cashier|driver|pedestrian|boy|girl|man|woman|kid|child|person|someone|figure|individual)\b/i;
    const hasSecondaryPerson = secondaryPersonKeywords.test(cleanedPrompt);

    const sceneHasIntenseLighting = intenseLightingKeywords.test(cleanedPrompt);
    const qualityBoost = sceneHasIntenseLighting ? style.qualityBoostNoLighting : style.qualityBoost;

    // Experiment J: trigger word + core identity moved to the very front of the
    // prompt (previously buried after the framing sentence and the entire
    // style.positive block) - some models weight earlier tokens more heavily,
    // so this keeps the LoRA identity anchor from being diluted by a long
    // preamble. Same fragments as before, only reordered.
    const finalPrompt = "Main subject: " + characterAnchor + ", realistic facial features preserved from reference photos. " + "Full unobstructed view of character's entire head and hair, vertical portrait framing, ample headroom, character never cropped at top of frame. " + style.positive + ". Scene: " + cleanedPrompt + ". The character must wear exactly: " + finalOutfit + " in this scene, outfit must not change, protagonist's full head and hair must remain fully visible even in crowd or group scenes, do not crop the main character's head to fit background characters" + identityReinforcement + backgroundDiversity + qualityBoost + style.styleConsistency;

    // Experiment B: extraLoraId is only ever set when the companion's trigger
    // word is actually present in this prompt (see companionLoraIdForPrompt in
    // app/skapa/page.tsx), so its absence combined with no multi-person
    // keywords means this specific scene depicts the main character alone -
    // the only case where a higher lora_scale carries no leakage risk to
    // other people in frame.
    const soloSceneBoostApplied = !extraLoraId && !hasMultiplePeople && !hasSecondaryPerson;

    // Experiment H: a smaller, deliberately more cautious boost for scenes
    // that DO have crowd/group/secondary-person keywords (i.e. exactly the
    // scenes experiment B/F correctly deny the larger solo boost to) - a
    // conscious tradeoff of somewhat higher leakage risk for hopefully better
    // main-character likeness. Only triggered by detected crowd/secondary-
    // person text, not merely by extraLoraId being set with no such keywords
    // (a companion referenced only by trigger word keeps the plain base
    // value - untouched, most conservative). Separate from experiment B's
    // fields entirely, so it can be rolled back independently.
    const crowdSceneMinorBoostApplied = !soloSceneBoostApplied && (hasMultiplePeople || hasSecondaryPerson);

    const activeLoraScale = soloSceneBoostApplied
      ? (isChild ? style.loraScaleSoloChild : style.loraScaleSolo)
      : crowdSceneMinorBoostApplied
        ? (isChild ? style.loraScaleCrowdChild : style.loraScaleCrowd)
        : (isChild ? style.loraScaleChild : style.loraScale);

    console.log("Style: " + styleKey + " | Intense lighting detected: " + sceneHasIntenseLighting + " | multiPersonKeywords matched: " + hasMultiplePeople + " | secondaryPersonKeywords matched: " + hasSecondaryPerson + " | Tested against: " + cleanedPrompt + " | soloSceneBoostApplied: " + soloSceneBoostApplied + " | crowdSceneMinorBoostApplied: " + crowdSceneMinorBoostApplied + " | lora_scale used: " + activeLoraScale + " | Prompt: " + finalPrompt);

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
