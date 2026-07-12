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

// Reads width/height straight out of the PNG file bytes (IHDR chunk: 8-byte
// PNG signature, then a 4-byte chunk length, 4-byte "IHDR" type, then width
// and height as big-endian uint32) instead of trusting any metadata the API
// response might or might not include - this is the actual pixel size of
// the file we're about to save and use, not a claim about it.
function getPngDimensions(buffer) {
  if (buffer.length < 24 || buffer.toString('ascii', 12, 16) !== 'IHDR') {
    return null;
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

// JPEG has no fixed-offset header - dimensions live inside a SOF (Start Of
// Frame) marker, found by walking the marker segments from byte 2 (right
// after the 0xFFD8 SOI marker). Each segment is 0xFF + a marker byte, then
// (for markers that carry data) a 2-byte big-endian length covering the
// length field itself. SOF markers are 0xC0-0xCF, excluding 0xC4 (DHT),
// 0xC8 (JPG, reserved/unused), and 0xCC (DAC) which are not actually SOF
// markers despite being in that numeric range. Inside a SOF segment the
// layout is: length(2) + precision(1) + height(2, BE) + width(2, BE).
function getJpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }
  let offset = 2;
  while (offset + 9 <= buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      // SOI/EOI/RSTn carry no length field.
      offset += 2;
      continue;
    }
    const segmentLength = buffer.readUInt16BE(offset + 2);
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + segmentLength;
  }
  return null;
}

// Tries the dimension reader matching the API's reported mimeType first (the
// actual authority on what bytes we got), then falls back to trying both
// formats in case the mimeType is missing or wrong - so this still reports
// real dimensions instead of giving up if either turns out to be unreliable.
function getImageDimensions(buffer, mimeType) {
  const wantsPng = (mimeType || '').includes('png');
  const wantsJpeg = (mimeType || '').includes('jpeg') || (mimeType || '').includes('jpg');
  if (wantsPng) return getPngDimensions(buffer) || getJpegDimensions(buffer);
  if (wantsJpeg) return getJpegDimensions(buffer) || getPngDimensions(buffer);
  return getPngDimensions(buffer) || getJpegDimensions(buffer);
}

function extensionForMimeType(mimeType) {
  if ((mimeType || '').includes('png')) return 'png';
  if ((mimeType || '').includes('jpeg') || (mimeType || '').includes('jpg')) return 'jpg';
  if ((mimeType || '').includes('webp')) return 'webp';
  return 'bin'; // unknown format - still save it, just without pretending to know the extension
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

async function generateImage(prompt, referenceImageBase64, apiVersion, model, imageConfig) {
  const url = 'https://generativelanguage.googleapis.com/' + apiVersion + '/models/' + model + ':generateContent';
  const body = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: 'image/jpeg', data: referenceImageBase64 } },
      ],
    }],
  };
  // OPEN QUESTION THIS TEST NEEDS TO ANSWER: does this API accept a
  // generationConfig.imageConfig.aspectRatio hint at all for this model, and
  // if so does it actually change the returned pixel dimensions? Not
  // confirmed yet - if the request is rejected, the caller's try/catch below
  // will surface the real error body rather than this silently being wrong.
  if (imageConfig) {
    body.generationConfig = { imageConfig };
  }

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

  // Report the mimeType Gemini actually declares (camelCase per the official
  // field name; snake_case inline_data kept as a fallback for symmetry with
  // the inline/inline_data check above) instead of assuming it matches the
  // .png filenames this script has been saving under - that assumption is
  // exactly what caused "could not read PNG dimensions" last run.
  return { data: inline.data, mimeType: inline.mimeType || inline.mime_type || null }; // data is base64
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

  // The book reader (app/skapa/page.tsx) renders every page/cover image with
  // CSS object-fit: cover inside a fixed-aspect container, so it always
  // crops to fill rather than requiring an exact pixel match - but the
  // closer the source aspect ratio is to the container's, the less content
  // gets cropped away. Current Replicate output is 1024x1152 (0.889 w/h,
  // requested explicitly via width/height input fields). The book page
  // container itself (BOOK_ASPECT in app/skapa/page.tsx) is 2:3 (0.667
  // w/h) - so even the CURRENT pipeline doesn't exactly match and already
  // relies on cover-crop. This test's job is just to find out (a) what
  // Gemini returns by default, and (b) whether it can be pointed closer to
  // portrait at all.
  for (const scene of scenes) {
    const prompt = buildPrompt(scene.text);
    console.log('\n=== ' + scene.name + ' ===');
    console.log('Prompt: ' + prompt);

    try {
      const result = await generateImage(prompt, referenceImageBase64, chosenApiVersion, chosenModel);
      if (!result) {
        console.error('No image returned for ' + scene.name);
        continue;
      }
      const buffer = Buffer.from(result.data, 'base64');
      const dims = getImageDimensions(buffer, result.mimeType);
      const filename = 'test-nanobanana-' + scene.name + '.' + extensionForMimeType(result.mimeType);
      fs.writeFileSync(filename, buffer);
      console.log('Saved ' + filename + ' (mimeType: ' + (result.mimeType || 'unknown') + (dims ? ', ' + dims.width + 'x' + dims.height + ', aspect ' + (dims.width / dims.height).toFixed(3) + ' w/h)' : ', could not read dimensions)'));
    } catch (err) {
      console.error('Failed for ' + scene.name + ': ' + err.message);
    }
  }

  // Dedicated aspect-ratio-control test(s): reuse the 'calm' scene prompt but
  // pass an explicit generationConfig.imageConfig.aspectRatio, to see whether
  // Gemini actually honors it and how closely the result matches what the
  // book reader needs. Confirmed in an earlier run: "3:4" produced 896x1200
  // (aspect 0.747) - close to requested but not exact, and still off from
  // the book page container's own BOOK_ASPECT of 2:3 (0.667 w/h, see
  // app/skapa/page.tsx). "2:3" is tested here as the exact match instead of
  // the nearest standard preset.
  await runAspectRatioTest('2:3', referenceImageBase64, chosenApiVersion, chosenModel);
  await runAspectRatioTest('3:4', referenceImageBase64, chosenApiVersion, chosenModel);

  async function runAspectRatioTest(aspectRatio, refImageBase64, apiVersion, model) {
    const label = aspectRatio.replace(':', '-');
    console.log('\n=== aspect-ratio-control (requesting ' + aspectRatio + ' via generationConfig.imageConfig) ===');
    try {
      const calmPrompt = buildPrompt(scenes[0].text);
      const result = await generateImage(calmPrompt, refImageBase64, apiVersion, model, { aspectRatio });
      if (!result) {
        console.error('No image returned for aspect-ratio-control test (' + aspectRatio + ')');
        return;
      }
      const buffer = Buffer.from(result.data, 'base64');
      const dims = getImageDimensions(buffer, result.mimeType);
      const filename = 'test-nanobanana-aspect-' + label + '.' + extensionForMimeType(result.mimeType);
      fs.writeFileSync(filename, buffer);
      console.log('Saved ' + filename + ' (mimeType: ' + (result.mimeType || 'unknown') + (dims ? ', ' + dims.width + 'x' + dims.height + ', aspect ' + (dims.width / dims.height).toFixed(3) + ' w/h)' : ', could not read dimensions)'));
      console.log('Compare this ratio to the default \'calm\' run above and to the other aspect-ratio-control run to judge fit against the 2:3 (0.667) book page container.');
    } catch (err) {
      console.error('Failed for aspect-ratio-control test (' + aspectRatio + '): ' + err.message);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
