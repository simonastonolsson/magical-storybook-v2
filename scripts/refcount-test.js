// Standalone, one-off test script - NOT part of the production app, NOT
// wired into any route. Run manually only:
//
//   GEMINI_API_KEY=your_key node scripts/refcount-test.js
//
// Tests whether the NUMBER of reference photos sent to Gemini (1 vs 3 vs 5
// vs 8) affects identity-preservation quality, now that photo consistency
// itself has been ruled out (all 8 real Bobban photos confirmed to show the
// same child, clear faces, not particularly different from each other).
//
// IMPORTANT: this mirrors the EXACT prompt structure app/api/generate-image/
// route.ts builds today - including the IDENTITY LOCK paragraph with the
// outfit-ignore instruction added to fix the outfit-drift bug - not the
// older, simpler prompt scripts/nano-banana-test.js originally used. If
// route.ts's prompt construction changes later, this script's copy will
// drift out of sync - that's an acceptable tradeoff for a one-off test, but
// worth knowing.
//
// Uses the same gemini-3-pro-image / v1beta / aspectRatio "2:3" config
// already confirmed working in production.

const fs = require('fs');
const https = require('https');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-3-pro-image';
const GEMINI_API_VERSION = 'v1beta';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/' + GEMINI_API_VERSION + '/models/' + GEMINI_MODEL + ':generateContent';
const GEMINI_ASPECT_RATIO = '2:3';

// ---- CONFIG: fill these in before running ----

// The 8 real reference photo URLs for Bobban, in the same order they
// appeared in the "generate-image request body" Vercel log line for this
// book. Order matters for the 1/3/5-image subsets below (first N are used).
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

// Confirmed against the real Vercel log line for this book (charDesc,
// charOutfit, bookStyle).
const CHAR_DESC = 'a young boy';
const CHAR_OUTFIT = 'Fotbollskläder i Celtics stil';

// Same calm/neutral scene used throughout this repo's earlier A/B tests
// (scripts/nano-banana-test.js, scripts/ip-adapter-test.js), so this result
// is comparable to those too.
const SCENE_TEXT = 'sitting on the grass, calmly tying his shoelaces before the match, focused expression';

// Mirrors STYLE_PROMPTS.digital_painting from generate-image/route.ts
// exactly - the wizard's default style. Adjust if this book actually used a
// different bookStyle (visible in the "generate-image style resolution"
// Vercel log line).
const STYLE = {
  positive: "digital painted illustration, painterly art style, soft brush strokes, natural volumetric lighting, cinematic composition, detailed background environment, high quality digital painting, concept art, story illustration",
  negative: "photograph, photorealistic, DSLR, 3D CGI, Pixar, anime, chibi, flat colors, hard outlines, duplicates",
  qualityBoost: ", cinematic dramatic lighting, rich composition, vivid saturated colors, high quality detailed illustration",
  styleConsistency: ", consistent painterly illustration style, uniform artistic rendering throughout",
};

const isChild = CHAR_DESC.toLowerCase().includes('boy') || CHAR_DESC.toLowerCase().includes('girl') || CHAR_DESC.toLowerCase().includes('child') || CHAR_DESC.toLowerCase().includes('baby');
const finalOutfit = CHAR_OUTFIT
  ? 'wearing ' + CHAR_OUTFIT
  : (isChild ? 'wearing a cozy yellow raincoat and blue denim jeans' : 'wearing a classic navy blue crew-neck sweater with round neckline and dark grey trousers');
const identityReinforcement = isChild
  ? ", character's exact childlike facial features and proportions preserved, do not age up"
  : ", character's exact facial features, bone structure and apparent age preserved from reference photos, do not age down or age up";
// Same as panelCompositionBoost in route.ts - this test scene is a panel, not a cover.
const panelCompositionBoost = ", layered scene composition with atmospheric depth, high contrast dramatic staging";

// Exact IDENTITY LOCK text as it exists in generate-image/route.ts today,
// including the "IMPORTANT: ... completely IGNORE any clothing..." sentence
// added to fix the outfit-drift bug.
const identitySubject = CHAR_DESC || 'person';
const identityLock = "IDENTITY LOCK (CRITICAL, NOT OPTIONAL): This must be 100% recognizable as the exact same " + identitySubject + " shown in the reference photos. Preserve all facial features, face shape, eye color, hair color and texture, and skin tone EXACTLY as shown in the reference photos - this is critical, not optional. Anyone who knows this " + identitySubject + " should immediately recognize them in the generated image. IMPORTANT: The reference photos are provided SOLELY to establish facial identity, face shape, and skin tone - completely IGNORE any clothing visible in the reference photos. The character's outfit in the generated image must strictly follow the outfit description below, regardless of what they happen to be wearing in the reference photos.";

// No multi-person/crowd keywords in SCENE_TEXT and no companion, so
// backgroundDiversity and companionClause are both "" here, same as route.ts
// would compute for this scene - simply omitted below rather than kept as
// empty-string concatenation.
function buildFinalPrompt(sceneText) {
  return identityLock + " " +
    "Full unobstructed view of character's entire head and hair, vertical portrait framing, ample headroom, character never cropped at top of frame. " +
    STYLE.positive + ". Scene: " + sceneText + ". The character must wear exactly: " + finalOutfit + " in this scene, outfit must not change, protagonist's full head and hair must remain fully visible even in crowd or group scenes, do not crop the main character's head to fit background characters" + identityReinforcement + STYLE.qualityBoost + panelCompositionBoost + STYLE.styleConsistency +
    ". Avoid: " + STYLE.negative + ", wrong outfit, different clothes, clone, duplicate face, cloned face, same face repeated on multiple people, identical twins in background, multiple people with same appearance.";
}

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

async function generateWithReferenceCount(count, prompt) {
  const urlsToUse = REFERENCE_IMAGE_URLS.slice(0, count);
  console.log('\n=== ' + count + ' reference image(s) ===');
  console.log('URLs used: ' + JSON.stringify(urlsToUse));

  const referenceImagesBase64 = await Promise.all(urlsToUse.map(fetchAsBase64));

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

  // Filenames are fixed as requested (test-refcount-N.jpg) - the mimeType is
  // still logged so a mismatch (e.g. Gemini returning PNG instead) is
  // visible rather than silently mislabeled.
  const filename = 'test-refcount-' + count + '.jpg';
  fs.writeFileSync(filename, Buffer.from(inline.data, 'base64'));
  console.log('Saved ' + filename + ' (mimeType: ' + (inline.mimeType || inline.mime_type || 'unknown') + ')');
}

async function main() {
  if (!GEMINI_API_KEY) {
    console.error('Set GEMINI_API_KEY in the environment before running.');
    process.exit(1);
  }
  if (REFERENCE_IMAGE_URLS.some((u) => u.startsWith('REPLACE_WITH'))) {
    console.error('Fill in the 8 real Bobban reference photo URLs in REFERENCE_IMAGE_URLS before running.');
    process.exit(1);
  }

  const prompt = buildFinalPrompt(SCENE_TEXT);
  console.log('Prompt used for every run (only the reference-image count changes):\n' + prompt);

  for (const count of [1, 3, 5, 8]) {
    try {
      await generateWithReferenceCount(count, prompt);
    } catch (err) {
      console.error('Failed for ' + count + ' reference images: ' + err.message);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
