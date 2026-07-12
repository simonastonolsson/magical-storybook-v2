// Standalone, one-off test script - NOT part of the production app, NOT
// wired into any route, and does NOT modify app/api/generate-image/route.ts,
// app/api/story/route.ts, or any other production code. Run manually only:
//
//   GEMINI_API_KEY=your_key node scripts/nano-banana-test.js
//
// Compares Google's "Nano Banana" (Gemini's native image generation) against
// our current Flux + trained LoRA pipeline, using the same three scene types
// already used in scripts/ip-adapter-test.js and scripts/pose-crowd-test.js
// (calm, action, secondary-character) for a like-for-like comparison, so we
// can judge whether Nano Banana's identity preservation is good enough to be
// worth a larger rebuild.
//
// AUTHENTICATION: reuses the SAME GEMINI_API_KEY already used for story
// generation (app/api/story/route.ts) - Nano Banana is Gemini's own image
// capability, not a separate product with its own key. No new credential
// needed. If you don't already have one: aistudio.google.com -> Get API key.
//
// API SHAPE: uses the plain REST generateContent endpoint (still fully
// supported alongside the newer Interactions API per Google's own docs) via
// plain fetch() - no new npm dependency needed, consistent with how
// scripts/ip-adapter-test.js avoided reinstalling a deprecated SDK.
//
// MODEL: defaults to "gemini-3-pro-image" (Google's premium/highest-quality
// image model) since the point of this test is judging best-case quality,
// not cost/speed - swap MODEL below to "gemini-3.1-flash-image" for the
// faster/cheaper workhorse model if you want that comparison instead.

const fs = require('fs');
const https = require('https');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// This is what we TRIED first - "gemini-3-pro-image" 404'd ("not found for
// API version v1, or is not supported for generateContent"). Kept here as
// the default the script will still attempt IF it turns out to actually be
// in the list below (e.g. under a different API version) - otherwise the
// script lists real models and stops rather than repeating the same failure.
const MODEL = 'gemini-3-pro-image';
const REFERENCE_IMAGE_URL = 'https://xaaduajcznqctcuymrzb.supabase.co/storage/v1/object/public/reference-images/754556d9-81e5-4718-8ee7-c0c4ce4a6a7d/reference-1783597467684.jpg';

// Lists models via Gemini's ListModels endpoint for a given API version
// ("v1" or "v1beta" - the 404 explicitly mentioned "API version v1", so it's
// worth checking whether the model actually lives under v1beta instead) and
// prints every model that supports generateContent, flagging ones whose
// name/description suggest image-generation capability ("Nano Banana").
async function listImageModels(apiVersion) {
  const url = 'https://generativelanguage.googleapis.com/' + apiVersion + '/models';
  const res = await fetch(url, { headers: { 'x-goog-api-key': GEMINI_API_KEY } });
  const rawBody = await res.text();
  if (!res.ok) {
    console.error('ListModels (' + apiVersion + ') failed (HTTP ' + res.status + '): ' + rawBody);
    return [];
  }
  const data = JSON.parse(rawBody);
  const models = data.models || [];
  const generateContentModels = models.filter((m) =>
    (m.supportedGenerationMethods || []).includes('generateContent')
  );

  console.log('\n=== Models under ' + apiVersion + ' supporting generateContent (' + generateContentModels.length + ') ===');
  for (const m of generateContentModels) {
    const looksLikeImage = /image|banana/i.test(m.name + ' ' + (m.displayName || '') + ' ' + (m.description || ''));
    console.log((looksLikeImage ? '  [IMAGE?] ' : '          ') + m.name + (m.displayName ? '  (' + m.displayName + ')' : ''));
  }

  return generateContentModels
    .filter((m) => /image|banana/i.test(m.name + ' ' + (m.displayName || '') + ' ' + (m.description || '')))
    .map((m) => m.name.replace(/^models\//, ''));
}

// Same three scene types used in ip-adapter-test.js, for a like-for-like
// comparison against the Flux + LoRA results.
const scenes = [
  { name: 'calm', text: 'sitting on the grass, calmly tying his shoelaces before the match, focused expression' },
  { name: 'action', text: 'kicking the football mid-air during the match, determined expression' },
  { name: 'secondary', text: 'shaking hands with the referee before the match, smiling politely, a curly-haired referee in a black uniform standing beside him' },
];

function buildPrompt(sceneText) {
  // No "comic book panel illustration" framing here - a previous run showed
  // Gemini taking that literally (black outlines, speech bubbles) instead of
  // the intended digital-painting look.
  return 'IDENTITY LOCK (CRITICAL, NOT OPTIONAL): This must be 100% recognizable as the exact same child ' +
    'shown in the reference photo. Preserve all facial features, face shape, eye color, hair color and ' +
    'texture, and skin tone EXACTLY as shown in the reference photo - this is critical, not optional. ' +
    'Anyone who knows this child should immediately recognize them in the generated image.\n\n' +
    'Style: digital painted illustration, painterly art style, soft brush strokes, natural volumetric ' +
    'lighting, cinematic composition. He is wearing his football kit (jersey and shorts).\n\n' +
    'Scene: ' + sceneText + '.';
}

function fetchAsBase64(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error('Failed to fetch reference image: HTTP ' + res.statusCode));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function generateImage(prompt, referenceImageBase64, apiVersion, model) {
  const url = 'https://generativelanguage.googleapis.com/' + apiVersion + '/models/' + model + ':generateContent';
  const body = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: 'image/jpeg', data: referenceImageBase64 } },
      ],
    }],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'x-goog-api-key': GEMINI_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const rawBody = await res.text();
  if (!res.ok) {
    throw new Error('Gemini API error (HTTP ' + res.status + '): ' + rawBody);
  }

  const data = JSON.parse(rawBody);
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p) => p.inlineData || p.inline_data);
  const inline = imagePart && (imagePart.inlineData || imagePart.inline_data);

  if (!inline || !inline.data) {
    console.error('Full response (no image data found): ' + rawBody);
    return null;
  }

  return inline.data; // base64
}

async function main() {
  if (!GEMINI_API_KEY) {
    console.error('Set GEMINI_API_KEY in the environment before running.');
    process.exit(1);
  }

  // "gemini-3-pro-image" 404'd under v1 ("not found for API version v1, or
  // is not supported for generateContent") - check both v1 and v1beta for
  // whatever image-capable models this key actually has access to, instead
  // of guessing model names again.
  const v1Images = await listImageModels('v1');
  const v1betaImages = await listImageModels('v1beta');

  // Prefer a v1 match (matches the API version generateImage() calls below),
  // fall back to v1beta if that's the only place the model is exposed.
  let chosenApiVersion = null;
  let chosenModel = null;
  if (v1Images.includes(MODEL)) {
    chosenApiVersion = 'v1';
    chosenModel = MODEL;
  } else if (v1betaImages.includes(MODEL)) {
    chosenApiVersion = 'v1beta';
    chosenModel = MODEL;
  } else if (v1Images.length > 0) {
    chosenApiVersion = 'v1';
    chosenModel = v1Images[0];
  } else if (v1betaImages.length > 0) {
    chosenApiVersion = 'v1beta';
    chosenModel = v1betaImages[0];
  }

  if (!chosenModel) {
    console.error('\nNo image-generation-capable model found under v1 or v1beta for this API key.');
    console.error('Check the full model lists printed above and update MODEL in this script by hand, then re-run.');
    process.exit(1);
  }

  console.log('\nUsing model "' + chosenModel + '" under API version "' + chosenApiVersion + '".');
  if (chosenModel !== MODEL) {
    console.log('(This is different from the MODEL constant in the script - update it to "' + chosenModel + '" to skip this fallback next time.)');
  }

  console.log('\nFetching reference image from ' + REFERENCE_IMAGE_URL + ' ...');
  const referenceImageBase64 = await fetchAsBase64(REFERENCE_IMAGE_URL);
  console.log('Reference image loaded (' + referenceImageBase64.length + ' base64 chars).');

  for (const scene of scenes) {
    const prompt = buildPrompt(scene.text);
    console.log('\n=== ' + scene.name + ' ===');
    console.log('Prompt: ' + prompt);

    try {
      const imageBase64 = await generateImage(prompt, referenceImageBase64, chosenApiVersion, chosenModel);
      if (!imageBase64) {
        console.error('No image returned for ' + scene.name);
        continue;
      }
      const filename = 'test-nanobanana-' + scene.name + '.png';
      fs.writeFileSync(filename, Buffer.from(imageBase64, 'base64'));
      console.log('Saved ' + filename);
    } catch (err) {
      console.error('Failed for ' + scene.name + ': ' + err.message);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
