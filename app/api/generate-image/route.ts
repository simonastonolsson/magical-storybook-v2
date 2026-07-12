import { NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Locked as a constant rather than re-running scripts/nano-banana-test.js's
// listImageModels() discovery on every request (extra latency/cost per
// call) - confirmed reachable and working for this API key during manual
// testing (see scripts/nano-banana-test.js). API version is "v1beta" rather
// than "v1" because the very first attempt at this model under "v1" 404'd
// ("not found for API version v1, or is not supported for generateContent");
// the discovery script's fallback logic found it successfully after that
// without reporting a different chosen model, which only happens if it
// matched under v1beta. Not independently re-verified against this exact
// production endpoint yet - the first real request (see build/test plan)
// will confirm or immediately surface a 404 if this assumption is wrong.
const GEMINI_MODEL = 'gemini-3-pro-image';
const GEMINI_API_VERSION = 'v1beta';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/' + GEMINI_API_VERSION + '/models/' + GEMINI_MODEL + ':generateContent';

// Confirmed via scripts/nano-banana-test.js against the real book page
// container (BOOK_ASPECT in app/skapa/page.tsx, 2:3 / 0.667 width/height):
// requesting aspectRatio "2:3" returned 848x1264 (aspect 0.671) - close
// enough that object-fit: cover (used by .book-page-img/.book-cover-img)
// crops negligibly. Applied to every call, covers included - the cover
// container's own ratio (COVER_ASPECT, ~0.727 w/h) is close enough that a
// single shared aspect ratio is simpler than branching per isCover, and the
// previous Replicate pipeline already used one fixed 1024x1152 for both.
const GEMINI_ASPECT_RATIO = '2:3';

const STYLE_PROMPTS: Record<string, { positive: string; negative: string; qualityBoost: string; qualityBoostNoLighting: string; styleConsistency: string }> = {
  digital_painting: {
    positive: "digital painted illustration, painterly art style, soft brush strokes, natural volumetric lighting, cinematic composition, detailed background environment, high quality digital painting, concept art, story illustration",
    negative: "photograph, photorealistic, DSLR, 3D CGI, Pixar, anime, chibi, flat colors, hard outlines, duplicates",
    qualityBoost: ", cinematic dramatic lighting, rich composition, vivid saturated colors, high quality detailed illustration",
    qualityBoostNoLighting: ", painterly illustrated rendering, rich composition, vivid saturated colors, high quality detailed illustration",
    styleConsistency: ", consistent painterly illustration style, uniform artistic rendering throughout"
  },
  ligne_claire: {
    positive: "ligne claire comic art style, clean precise ink outlines, flat cel colors, bright even lighting, clear readable panels, European bande dessinee style, Tintin inspired illustration, bold outlines, simple clean backgrounds",
    negative: "photograph, photorealistic, 3D CGI, anime, shading, dark shadows, watercolor, rough textures, duplicates",
    qualityBoost: ", rich detailed composition, vivid bold flat colors, high quality clean illustration",
    qualityBoostNoLighting: ", rich detailed composition, vivid bold flat colors, high quality clean illustration",
    styleConsistency: ", consistent clean-line illustration style, uniform artistic rendering throughout"
  },
  american_comic: {
    positive: "American superhero comic book art, bold ink outlines, dynamic composition, strong contrasting colors, Marvel DC style illustration, halftone dots, dramatic lighting, action comic panel, professional comic art",
    negative: "photograph, photorealistic, 3D CGI, anime, watercolor, soft colors, duplicates, blurry",
    qualityBoost: ", cinematic dramatic lighting, rich dynamic composition, vivid saturated colors, high quality detailed illustration",
    qualityBoostNoLighting: ", bold comic illustrated rendering, rich dynamic composition, vivid saturated colors, high quality detailed illustration",
    styleConsistency: ", consistent bold comic illustration style, uniform artistic rendering throughout"
  },
  watercolor: {
    positive: "cozy heartwarming 2D hand-drawn watercolor storybook illustration, soft pencil sketch details, beautiful muted watercolor washes, warm pastel color palette, gentle sunlit lighting, clean elegant hand-drawn outlines, warm and inviting cozy atmosphere",
    negative: "photograph, photorealistic, 3D CGI, Pixar, anime, chibi, hard outlines, flat digital colors, duplicates",
    qualityBoost: ", rich detailed composition, luminous glowing colors, high quality detailed illustration",
    qualityBoostNoLighting: ", rich detailed composition, luminous glowing colors, high quality detailed illustration",
    styleConsistency: ", consistent hand-painted watercolor illustration style, uniform artistic rendering throughout"
  },
  noir: {
    positive: "black and white noir comic illustration, high contrast ink drawing, dramatic shadows, cross-hatching technique, graphic novel art style, Sin City inspired, expressive ink lines, moody atmosphere, detailed pen and ink illustration",
    negative: "color, photograph, photorealistic, 3D CGI, anime, watercolor, pastel colors, duplicates",
    qualityBoost: ", dramatic high-contrast lighting, rich detailed composition, high quality detailed illustration",
    qualityBoostNoLighting: ", ink-drawn illustrated rendering, rich detailed composition, high quality detailed illustration",
    styleConsistency: ", consistent ink-drawn illustration style, uniform artistic rendering throughout"
  },
  pop_art: {
    positive: "Roy Lichtenstein pop art comic style, bold black outlines, Ben-Day dots pattern, primary flat colors, retro comic book illustration, speech bubbles style, graphic pop art panel, strong graphic design aesthetic",
    negative: "photograph, photorealistic, 3D CGI, anime, soft colors, watercolor, realistic shading, duplicates",
    qualityBoost: ", bold dynamic composition, vivid saturated colors, high quality detailed illustration",
    qualityBoostNoLighting: ", bold dynamic composition, vivid saturated colors, high quality detailed illustration",
    styleConsistency: ", consistent graphic pop art illustration style, uniform artistic rendering throughout"
  }
};

// Experiment A: when the scene's own image_prompt already establishes strong,
// color-tinted or directional lighting, don't stack a second generic "dramatic
// lighting" instruction on top of it via qualityBoost - the two independent
// lighting cues compounding is a suspected contributor to identity drift
// (e.g. hair color) in strongly lit scenes. Still relevant with Gemini: this
// is a prompt-text decision, not a LoRA one.
const intenseLightingKeywords = /\b(sunset|sunrise|golden hour|dusk|twilight|warm light|warm glow|warm glowing|dramatic light|dramatically lit|backlit|back-lit|silhouett\w*|firelight|fire light|candlelight|candle light|neon light|moonlit|moonlight|spotlight|harsh light|glowing embers|campfire|bonfire|lantern light|colou?red light(?:ing)?|stage lights?)\b/i;

// Widened after a confirmed miss: a hockey scene ("teammates", "other
// players", "spectators", "stands") matched none of the original narrow
// list, so the scene was wrongly classified as solo and the background
// diversity instruction below was skipped, leaking the main character's face
// onto background teammates/spectators. Deliberately broad - better to over-
// apply the diversity instruction than to risk leakage again.
const multiPersonKeywords = /\b(crowd|crowds|spectator|spectators|audience|bystanders|onlookers|classmates|teammates|team-mates|team mates|players|other players|opposing team|opponents|skaters|other skaters|athletes|competitors|racers|dancers|singers|passengers|customers|guests|coworkers|colleagues|siblings|friends|family members|fans|cheering|stands|bleachers|stadium|arena|rink full of|group of|groups of|several people|many people|lots of people|dozens of|hundreds of|everyone|everybody|whole team|entire team|full team|packed (stands|arena|rink)|other (people|kids|children|students|players|skaters|athletes|teammates|racers|dancers|competitors)|companions|surrounded by|background characters|watching crowd|people watching)\b/i;

async function fetchReferenceImageAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch reference image: HTTP ' + res.status);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer).toString('base64');
}

export async function POST(request: Request) {
  try {
    const { prompt, referenceImageUrls, charDesc, charOutfit, bookStyle, isCover, companionReferenceImageUrl, companionName } = await request.json();

    console.log("generate-image request body:", { prompt, referenceImageUrls, charDesc, charOutfit, bookStyle, companionReferenceImageUrl, companionName });

    if (!Array.isArray(referenceImageUrls) || referenceImageUrls.length === 0) {
      return NextResponse.json({ error: 'Missing referenceImageUrls' }, { status: 400 });
    }
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Missing GEMINI_API_KEY' }, { status: 500 });
    }

    const isChild = charDesc?.toLowerCase().includes("boy") ||
                    charDesc?.toLowerCase().includes("girl") ||
                    charDesc?.toLowerCase().includes("child") ||
                    charDesc?.toLowerCase().includes("baby");

    const defaultOutfit = isChild
      ? "wearing a cozy yellow raincoat and blue denim jeans"
      : "wearing a classic navy blue crew-neck sweater with round neckline and dark grey trousers";

    const finalOutfit = charOutfit ? "wearing " + charOutfit : defaultOutfit;

    // Verifies the outfit-lock fix: charOutfit received here should be the
    // same text story/route.ts used to build Gemini's signatureOutfit, so
    // the scene text and this lock sentence don't contradict each other.
    console.log("Outfit check | charOutfit received: " + JSON.stringify(charOutfit) + " | finalOutfit injected into outfit lock: " + JSON.stringify(finalOutfit));

    const styleKey = bookStyle || 'digital_painting';
    const style = STYLE_PROMPTS[styleKey] || STYLE_PROMPTS['digital_painting'];

    console.log("generate-image style resolution:", { receivedBookStyle: bookStyle, resolvedStyleKey: styleKey });

    let cleanedPrompt = prompt || "";

    const stylePrefix = "Comic book panel illustration, graphic novel art,";
    if (cleanedPrompt.toLowerCase().startsWith(stylePrefix.toLowerCase())) {
      cleanedPrompt = cleanedPrompt.slice(stylePrefix.length).trim();
    }
    cleanedPrompt = cleanedPrompt.replace(/^[\s,]+/, "");

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

    const multiPersonMatches = cleanedPrompt.match(new RegExp(multiPersonKeywords.source, 'gi')) || [];
    const hasMultiplePeople = multiPersonMatches.length > 0;
    const backgroundDiversity = hasMultiplePeople
      ? ", background characters have diverse and varied faces, different from the protagonist, unrelated bystanders with distinct individual appearances"
      : "";

    const sceneHasIntenseLighting = intenseLightingKeywords.test(cleanedPrompt);
    const qualityBoost = sceneHasIntenseLighting ? style.qualityBoostNoLighting : style.qualityBoost;

    // Cover prompts (buildCoverPrompt in app/skapa/page.tsx) bake their own
    // composition/lighting flourish directly into the scene text itself, on
    // top of the SAME qualityBoost panels also get - a genuine double dose.
    // Panels only get the single qualityBoost, since Gemini's own scene text
    // is comparatively plain/functional - give panels an equivalent second
    // layer here, using different words than qualityBoost already
    // contributes to avoid repeating the same phrase twice in one prompt.
    const panelCompositionBoost = ", layered scene composition with atmospheric depth, high contrast dramatic staging";

    // Read-only diagnostic for the "medium close-up shot" vs "waist-up...
    // medium shot" framing observation - no behavior change. Gemini picks
    // this phrase freely per panel from CAMERA FRAMING RULE's menu in
    // story/route.ts; nothing in this file selects or generates it.
    const framingPhrasesFound = (cleanedPrompt.match(/medium close-up|waist-up[a-z ,-]*(medium )?shot|three-quarter face view|wide angle|shot from a distance|establishing shot/gi) || []);
    console.log("Framing check | Phrases found in this panel's prompt: " + JSON.stringify(framingPhrasesFound));

    // IDENTITY LOCK: replaces the old "Main subject: TOK, ..." LoRA-trigger-
    // word opening. Wording matches what was manually tested and confirmed
    // to give strong identity preservation against Gemini (see
    // scripts/nano-banana-test.js's buildPrompt()) - a prominent, first-
    // paragraph statement rather than a trailing clause.
    const identitySubject = charDesc || "person";
    const identityLock = "IDENTITY LOCK (CRITICAL, NOT OPTIONAL): This must be 100% recognizable as the exact same " + identitySubject + " shown in the reference photo. Preserve all facial features, face shape, eye color, hair color and texture, and skin tone EXACTLY as shown in the reference photo - this is critical, not optional. Anyone who knows this " + identitySubject + " should immediately recognize them in the generated image.";

    // Replaces the old extraLoraId/extraLoraScale mechanism (a second trained
    // LoRA blended in for scenes mentioning the companion by trigger word).
    // Gemini has no LoRA concept, but it does accept multiple reference
    // images in one request - so the companion's own reference photo is sent
    // as a second inline_data part instead, with a clause telling Gemini
    // which photo is which. Only present when the companion has its own
    // saved reference photo AND this specific panel's prompt actually
    // mentions the companion (see companionReferenceImageUrlForPrompt in
    // app/skapa/page.tsx) - same "only when relevant to this scene" gating
    // the old LoRA version used, just with a photo instead of a model id.
    const companionClause = companionReferenceImageUrl
      ? " A second reference photo shows " + (companionName || "the companion character") + " - preserve their appearance consistently as well."
      : "";

    const finalPrompt = identityLock + " " +
      "Full unobstructed view of character's entire head and hair, vertical portrait framing, ample headroom, character never cropped at top of frame. " +
      style.positive + ". Scene: " + cleanedPrompt + ". The character must wear exactly: " + finalOutfit + " in this scene, outfit must not change, protagonist's full head and hair must remain fully visible even in crowd or group scenes, do not crop the main character's head to fit background characters" + identityReinforcement + backgroundDiversity + qualityBoost + (isCover ? "" : panelCompositionBoost) + style.styleConsistency + companionClause +
      ". Avoid: " + style.negative + ", wrong outfit, different clothes, clone, duplicate face, cloned face, same face repeated on multiple people, identical twins in background, multiple people with same appearance.";

    console.log("Style: " + styleKey + " | isCover: " + !!isCover + " | Intense lighting detected: " + sceneHasIntenseLighting + " | multiPersonKeywords matched: " + hasMultiplePeople + " (" + JSON.stringify(multiPersonMatches) + ")" + " | companion reference image included: " + !!companionReferenceImageUrl + " | Prompt: " + finalPrompt);

    // Multiple reference photos of the main character all go in as separate
    // inline_data parts in the same request (confirmed via earlier research:
    // Gemini accepts up to 14 images per request) - more angles of the same
    // face should only help identity preservation, same reasoning as why the
    // wizard now collects 5-8 photos instead of just one.
    const referenceImagesBase64 = await Promise.all(
      referenceImageUrls.map((url: string) => fetchReferenceImageAsBase64(url))
    );

    const contentParts: any[] = [
      { text: finalPrompt },
      ...referenceImagesBase64.map((data) => ({ inline_data: { mime_type: 'image/jpeg', data } })),
    ];

    if (companionReferenceImageUrl) {
      const companionImageBase64 = await fetchReferenceImageAsBase64(companionReferenceImageUrl);
      contentParts.push({ inline_data: { mime_type: 'image/jpeg', data: companionImageBase64 } });
    }

    const geminiRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'x-goog-api-key': GEMINI_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: contentParts }],
        generationConfig: {
          imageConfig: { aspectRatio: GEMINI_ASPECT_RATIO },
        },
      }),
    });

    const rawBody = await geminiRes.text();
    if (!geminiRes.ok) {
      console.error('Gemini API error (HTTP ' + geminiRes.status + '): ' + rawBody);
      return NextResponse.json({ error: 'Image generation failed' }, { status: 500 });
    }

    const data = JSON.parse(rawBody);
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p: any) => p.inlineData || p.inline_data);
    const inline = imagePart && (imagePart.inlineData || imagePart.inline_data);

    if (!inline?.data) {
      console.error('Gemini response had no image data: ' + rawBody);
      return NextResponse.json({ error: 'Image generation failed' }, { status: 500 });
    }

    // No hosted URL comes back from Gemini (unlike Replicate) - the app never
    // persisted generated page/cover images anywhere itself (generatedImages/
    // coverImageUrl are plain in-memory React state, used directly as <img
    // src> and for window.print()), so a data: URL is a drop-in replacement
    // with the same session-only lifetime the Replicate CDN URLs already had.
    const mimeType = inline.mimeType || inline.mime_type || 'image/png';
    const imageUrl = 'data:' + mimeType + ';base64,' + inline.data;

    return NextResponse.json({ imageUrl });

  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}
