// Standalone, one-off test script - NOT part of the production app, NOT
// wired into any route. Run manually only:
//
//   GEMINI_API_KEY=your_key node scripts/complexity-test.js
//
// Follow-up to scripts/refcount-test.js, which confirmed 8 reference photos
// give the best identity match for a simple, calm, solo scene. This script
// holds the reference-photo count fixed at 8 (the now-confirmed best case)
// and instead varies SCENE COMPLEXITY one variable at a time, to isolate
// why a real book ("Bobbans Seger") showed worse likeness specifically in
// its crowd/triumph-pose panels and cover - mirrors the isolate-one-variable
// approach of scripts/pose-crowd-test.js from earlier in this session
// (built for the old Flux+LoRA pipeline), now adapted to the current Gemini
// pipeline and using all 8 real reference photos throughout.
//
// Like scripts/refcount-test.js, this mirrors generate-image/route.ts's
// CURRENT exact prompt construction (IDENTITY LOCK incl. the outfit-ignore
// instruction, multiPersonKeywords -> backgroundDiversity, panelComposition-
// Boost only for non-cover panels, etc.) - not a simplified reinterpretation.
// If route.ts's prompt logic changes later, this copy will drift out of
// sync - acceptable for a one-off diagnostic script.

const fs = require('fs');
const https = require('https');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-3-pro-image';
const GEMINI_API_VERSION = 'v1beta';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/' + GEMINI_API_VERSION + '/models/' + GEMINI_MODEL + ':generateContent';
const GEMINI_ASPECT_RATIO = '2:3';

// Same 8 real Bobban reference photos, same order, as confirmed via Vercel
// logs and already used in scripts/refcount-test.js. Always all 8 here -
// reference count is no longer the variable under test.
const REFERENCE_IMAGE_URLS = [
  'https://xaaduajcznqctcuymrzb.supabase.co/storage/v1/object/public/reference-images/754556d9-81e5-4718-8ee7-c0c4ce4a6a7d/reference-1783887441228.jpg',
  'https://xaaduajcznqctcuymrzb.supabase.co/storage/v1/object/public/reference-images/754556d9-81e5-4718-8ee7-c0c4ce4a6a7d/reference-1783887441093.jpg',
  'https://xaaduajcznqctcuymrzb.supabase.co/storage/v1/object/public/reference-images/754556d9-81e5-4718-8ee7-c0c4ce4a6a7d/reference-1783887441955.jpg',
  'https://xaaduajcznqctcuymrzb.supabase.co/storage/v1/object/public/reference-images/754556d9-81e5-4718-8ee7-c0c4ce4a6a7d/reference-1783887441061.jpg',
  'https://xaaduajcznqctcuymrzb.supabase.co/storage/v1/object/public/reference-images/754556d9-81e5-4718-8ee7-c0c4ce4a6a7d/reference-1783887441014.jpg',
  'https://xaaduajcznqctcuymrzb.supabase.co/storage/v1/object/public/reference-images/754556d9-81e5-4718-8ee7-c0c4ce4a6a7d/reference-1783887441028.jpg',
  'https://xaaduajcznqctcuymrzb.supabase.co/storage/v1/object/public/reference-images/754556d9-81e5-4718-8ee7-c0c4ce4a6a7d/reference-1783887441200.jpg',
  'https://xaaduajcznqctcuymrzb.supabase.co/storage/v1/object/public/reference-images/754556d9-81e5-4718-8ee7-c0c4ce4a6a7d/reference-1783887441721.jpg',
];

const CHAR_DESC = 'a young boy';
const CHAR_OUTFIT = 'Fotbollskläder i Celtics stil';

// Mirrors STYLE_PROMPTS.digital_painting from generate-image/route.ts exactly.
const STYLE = {
  positive: "digital painted illustration, painterly art style, soft brush strokes, natural volumetric lighting, cinematic composition, detailed background environment, high quality digital painting, concept art, story illustration",
  negative: "photograph, photorealistic, DSLR, 3D CGI, Pixar, anime, chibi, flat colors, hard outlines, duplicates",
  qualityBoost: ", cinematic dramatic lighting, rich composition, vivid saturated colors, high quality detailed illustration",
  qualityBoostNoLighting: ", painterly illustrated rendering, rich composition, vivid saturated colors, high quality detailed illustration",
  styleConsistency: ", consistent painterly illustration style, uniform artistic rendering throughout",
};

// Copied verbatim from generate-image/route.ts.
const intenseLightingKeywords = /\b(sunset|sunrise|golden hour|dusk|twilight|warm light|warm glow|warm glowing|dramatic light|dramatically lit|backlit|back-lit|silhouett\w*|firelight|fire light|candlelight|candle light|neon light|moonlit|moonlight|spotlight|harsh light|glowing embers|campfire|bonfire|lantern light|colou?red light(?:ing)?|stage lights?)\b/i;
const multiPersonKeywords = /\b(crowd|crowds|spectator|spectators|audience|bystanders|onlookers|classmates|teammates|team-mates|team mates|players|other players|opposing team|opponents|skaters|other skaters|athletes|competitors|racers|dancers|singers|passengers|customers|guests|coworkers|colleagues|siblings|friends|family members|fans|cheering|stands|bleachers|stadium|arena|rink full of|group of|groups of|several people|many people|lots of people|dozens of|hundreds of|everyone|everybody|whole team|entire team|full team|packed (stands|arena|rink)|other (people|kids|children|students|players|skaters|athletes|teammates|racers|dancers|competitors)|companions|surrounded by|background characters|watching crowd|people watching)\b/i;

const isChild = CHAR_DESC.toLowerCase().includes('boy') || CHAR_DESC.toLowerCase().includes('girl') || CHAR_DESC.toLowerCase().includes('child') || CHAR_DESC.toLowerCase().includes('baby');
const finalOutfit = CHAR_OUTFIT
  ? 'wearing ' + CHAR_OUTFIT
  : (isChild ? 'wearing a cozy yellow raincoat and blue denim jeans' : 'wearing a classic navy blue crew-neck sweater with round neckline and dark grey trousers');
const identityReinforcement = isChild
  ? ", character's exact childlike facial features and proportions preserved, do not age up"
  : ", character's exact facial features, bone structure and apparent age preserved from reference photos, do not age down or age up";
const panelCompositionBoost = ", layered scene composition with atmospheric depth, high contrast dramatic staging";

const identitySubject = CHAR_DESC || 'person';
const identityLock = "IDENTITY LOCK (CRITICAL, NOT OPTIONAL): This must be 100% recognizable as the exact same " + identitySubject + " shown in the reference photos. Preserve all facial features, face shape, eye color, hair color and texture, and skin tone EXACTLY as shown in the reference photos - this is critical, not optional. Anyone who knows this " + identitySubject + " should immediately recognize them in the generated image. IMPORTANT: The reference photos are provided SOLELY to establish facial identity, face shape, and skin tone - completely IGNORE any clothing visible in the reference photos. The character's outfit in the generated image must strictly follow the outfit description below, regardless of what they happen to be wearing in the reference photos.";

// Mirrors generate-image/route.ts's finalPrompt construction exactly,
// including the multiPersonKeywords -> backgroundDiversity check and the
// isCover -> panelCompositionBoost gating. No companion in any of these
// scenes, so companionClause is always "".
function buildFinalPrompt(sceneText, isCover) {
  const multiPersonMatches = sceneText.match(new RegExp(multiPersonKeywords.source, 'gi')) || [];
  const hasMultiplePeople = multiPersonMatches.length > 0;
  const backgroundDiversity = hasMultiplePeople
    ? ", background characters have diverse and varied faces, different from the protagonist, unrelated bystanders with distinct individual appearances"
    : "";

  const sceneHasIntenseLighting = intenseLightingKeywords.test(sceneText);
  const qualityBoost = sceneHasIntenseLighting ? STYLE.qualityBoostNoLighting : STYLE.qualityBoost;

  const prompt = identityLock + " " +
    "Full unobstructed view of character's entire head and hair, vertical portrait framing, ample headroom, character never cropped at top of frame. " +
    STYLE.positive + ". Scene: " + sceneText + ". The character must wear exactly: " + finalOutfit + " in this scene, outfit must not change, protagonist's full head and hair must remain fully visible even in crowd or group scenes, do not crop the main character's head to fit background characters" + identityReinforcement + backgroundDiversity + qualityBoost + (isCover ? "" : panelCompositionBoost) + STYLE.styleConsistency +
    ". Avoid: " + STYLE.negative + ", wrong outfit, different clothes, clone, duplicate face, cloned face, same face repeated on multiple people, identical twins in background, multiple people with same appearance.";

  return { prompt, hasMultiplePeople, multiPersonMatches, sceneHasIntenseLighting };
}

// The same calm scene confirmed good in refcount-test.js - the fixed
// baseline every other variant changes exactly one thing from.
const BASE_SCENE = 'sitting on the grass, calmly tying his shoelaces before the match, focused expression';
const TRIUMPH_POSE = 'standing on the football pitch, arms raised in a triumphant victorious pose after winning the match, big excited smile';

// Reuses the cover's own composition framing (from buildCoverPrompt in
// app/skapa/page.tsx) around the SAME neutral base scene/pose - isolates the
// composition-instruction variable specifically, rather than also pulling
// in a real book's title/memory text, which would conflate two variables.
const COVER_COMPOSITION_SCENE = 'waist-up close-up portrait composition with the character large and close in the foreground, ' + BASE_SCENE + ', the character\'s entire head and hair fully visible with generous headroom above, never cropped at the top of frame';

const VARIANTS = [
  { label: 'base', filename: 'test-complexity-base.jpg', sceneText: BASE_SCENE, isCover: false },
  { label: 'pose', filename: 'test-complexity-pose.jpg', sceneText: TRIUMPH_POSE, isCover: false },
  { label: 'crowd', filename: 'test-complexity-crowd.jpg', sceneText: BASE_SCENE + ', teammates and spectators visible in the background', isCover: false },
  { label: 'both', filename: 'test-complexity-both.jpg', sceneText: TRIUMPH_POSE + ', teammates and cheering spectators celebrating around him in the background', isCover: false },
  { label: 'cover', filename: 'test-complexity-cover.jpg', sceneText: COVER_COMPOSITION_SCENE, isCover: true },
];

function fetchAsBase64(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error('Failed to fetch reference image (' + url + '): HTTP ' + res.statusCode));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function generateVariant(variant, referenceImagesBase64) {
  const { prompt, hasMultiplePeople, multiPersonMatches, sceneHasIntenseLighting } = buildFinalPrompt(variant.sceneText, variant.isCover);

  console.log('\n=== ' + variant.label + ' ===');
  console.log('Scene: ' + variant.sceneText);
  console.log('isCover: ' + variant.isCover + ' | multiPersonKeywords matched: ' + hasMultiplePeople + ' (' + JSON.stringify(multiPersonMatches) + ') | intense lighting: ' + sceneHasIntenseLighting);
  console.log('Prompt: ' + prompt);

  const parts = [
    { text: prompt },
    ...referenceImagesBase64.map((data) => ({ inline_data: { mime_type: 'image/jpeg', data } })),
  ];

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: {
      'x-goog-api-key': GEMINI_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { imageConfig: { aspectRatio: GEMINI_ASPECT_RATIO } },
    }),
  });

  const rawBody = await res.text();
  if (!res.ok) {
    throw new Error('Gemini API error (HTTP ' + res.status + '): ' + rawBody);
  }

  const data = JSON.parse(rawBody);
  const responseParts = data?.candidates?.[0]?.content?.parts || [];
  const imagePart = responseParts.find((p) => p.inlineData || p.inline_data);
  const inline = imagePart && (imagePart.inlineData || imagePart.inline_data);

  if (!inline || !inline.data) {
    console.error('Full response (no image data found): ' + rawBody);
    return;
  }

  fs.writeFileSync(variant.filename, Buffer.from(inline.data, 'base64'));
  console.log('Saved ' + variant.filename + ' (mimeType: ' + (inline.mimeType || inline.mime_type || 'unknown') + ')');
}

async function main() {
  if (!GEMINI_API_KEY) {
    console.error('Set GEMINI_API_KEY in the environment before running.');
    process.exit(1);
  }

  console.log('Fetching 8 reference photos (shared across all 5 variants) ...');
  const referenceImagesBase64 = await Promise.all(REFERENCE_IMAGE_URLS.map(fetchAsBase64));
  console.log('Loaded ' + referenceImagesBase64.length + ' reference photos.');

  for (const variant of VARIANTS) {
    try {
      await generateVariant(variant, referenceImagesBase64);
    } catch (err) {
      console.error('Failed for ' + variant.label + ': ' + err.message);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
