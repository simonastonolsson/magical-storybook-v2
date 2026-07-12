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
const MODEL = 'gemini-3-pro-image';
const REFERENCE_IMAGE_URL = 'https://xaaduajcznqctcuymrzb.supabase.co/storage/v1/object/public/reference-images/754556d9-81e5-4718-8ee7-c0c4ce4a6a7d/reference-1783597467684.jpg';

// Same three scene types used in ip-adapter-test.js, for a like-for-like
// comparison against the Flux + LoRA results.
const scenes = [
  { name: 'calm', text: 'sitting on the grass, calmly tying his shoelaces before the match, focused expression' },
  { name: 'action', text: 'kicking the football mid-air during the match, determined expression' },
  { name: 'secondary', text: 'shaking hands with the referee before the match, smiling politely, a curly-haired referee in a black uniform standing beside him' },
];

function buildPrompt(sceneText) {
  return 'Using the boy shown in the reference photo, generate a comic book panel illustration in a ' +
    'digital painted illustration style, painterly art style, soft brush strokes, natural volumetric ' +
    'lighting, cinematic composition. He is wearing his football kit (jersey and shorts). Keep his face, ' +
    'hair, and skin tone consistent with the reference photo. Scene: ' + sceneText + '.';
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

async function generateImage(prompt, referenceImageBase64) {
  const url = 'https://generativelanguage.googleapis.com/v1/models/' + MODEL + ':generateContent';
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

  console.log('Fetching reference image from ' + REFERENCE_IMAGE_URL + ' ...');
  const referenceImageBase64 = await fetchAsBase64(REFERENCE_IMAGE_URL);
  console.log('Reference image loaded (' + referenceImageBase64.length + ' base64 chars).');

  for (const scene of scenes) {
    const prompt = buildPrompt(scene.text);
    console.log('\n=== ' + scene.name + ' ===');
    console.log('Prompt: ' + prompt);

    try {
      const imageBase64 = await generateImage(prompt, referenceImageBase64);
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
