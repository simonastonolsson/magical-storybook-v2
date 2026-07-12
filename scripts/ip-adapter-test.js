// Standalone, one-off test script - NOT part of the production app, NOT
// wired into any Next.js route (deliberately placed under scripts/, not
// app/api/, so it can never accidentally become a live endpoint again).
// Run manually only, when you're ready to spend real fal.ai time/cost:
//
//   FAL_KEY=your_fal_key node scripts/ip-adapter-test.js
//
// Restores and adapts the logic from app/api/generate-image-fal/route.ts,
// which was deleted in commit 471a5f8 (2026-07-08) as dead code - it was
// written to combine our trained Replicate LoRA with fal.ai's IP-Adapter
// FaceID (using a reference photo), but the client never called it, so
// there is NO evidence it was ever actually tested end to end. This script
// is that missing test: same scene/seed/outfit, generated once WITHOUT
// (method A) and once WITH (method B) the IP-Adapter reference image, for
// three different scene types, to see whether the reference image
// actually helps and whether it helps consistently.
//
// WHY RAW fetch() INSTEAD OF REINSTALLING @fal-ai/serverless-client:
// that package was removed in the same commit that deleted this route,
// noted at the time as deprecated per npm's own install warning. Pulling
// a deprecated package back into package.json just for a throwaway test
// seemed like the wrong tradeoff - fal.ai's REST API (submit to
// queue.fal.run, poll the status URL, fetch the response URL) is simple
// enough to call directly with Node's built-in fetch, with no new
// dependency and full visibility into the exact request/response shapes,
// which is useful for debugging a brand new integration anyway.
//
// KNOWN OPEN QUESTION THIS TEST ITSELF NEEDS TO ANSWER: fal.ai's docs for
// the `loras[].path` field only say "URL or the path to the LoRA weights"
// - they don't confirm whether a Replicate destination model reference
// (owner/model:version, what our own trainedModelId normally is) or a
// raw .tar/.safetensors weights file URL (what Replicate's own
// training.output.weights gives us) is actually expected. The original
// deleted code passed trainedModelId (a Replicate model reference)
// directly, untested. This script defaults to the RAW WEIGHTS URL
// instead (see loraWeightsUrl below), since "a URL to the weights" reads
// more literally as a direct file link - but this is a guess, not a
// confirmed fact, and may need adjusting based on fal.ai's actual error
// message if it rejects the value.

const fs = require('fs');
const https = require('https');

const FAL_KEY = process.env.FAL_KEY;

// ---- CONFIG: fill these in with real values before running ----
// Bobban's trained LoRA weights URL - the raw .tar/.safetensors file from
// Replicate's training output (training.output.weights), NOT the
// "owner/model:version" string used elsewhere in this app for Replicate's
// own replicate.run() - see the open question above for why.
const loraWeightsUrl = 'https://replicate.delivery/xezq/1XGMqkf1tnzUQSdLR54GvkBkTaUMW6erLWhEge9Qf05pXPdbB/trained_model.tar';
// Bobban's actual reference photo URL, for the IP-Adapter FaceID input.
// Find it via Supabase: `select reference_image_url from user_models where
// trigger_word = 'BOBBANTOK';` - or open the character picker in the app
// and inspect the thumbnail <img>'s src in devtools.
const referenceImageUrl = 'https://xaaduajcznqctcuymrzb.supabase.co/storage/v1/object/public/reference-images/754556d9-81e5-4718-8ee7-c0c4ce4a6a7d/reference-1783597467684.jpg';

const triggerWord = 'BOBBANTOK';
const charDesc = 'a young boy';
const charOutfit = 'football kit, jersey and shorts';
const isChild = true;
const signatureOutfit = isChild
  ? 'wearing a cozy yellow raincoat and blue denim jeans' // fallback only - charOutfit below overrides this in practice
  : 'wearing a classic navy blue sweater and dark grey trousers';
const characterAnchor = triggerWord + ', ' + charDesc + ', wearing ' + charOutfit;

// Three scene types, written with the same restraint our current
// EXPRESSION/POSE MODERATION RULEs require (calm wording, no extreme
// expressions or symmetrical big poses) so this test isolates the
// IP-Adapter variable, not a moderation-rule variable.
const scenes = [
  { name: 'calm', seed: 111111, text: 'sitting on the grass, calmly tying his shoelaces before the match, focused expression' },
  { name: 'action', seed: 222222, text: 'kicking the football mid-air during the match, determined expression' },
  { name: 'secondary', seed: 333333, text: 'shaking hands with the referee before the match, smiling politely, a curly-haired referee in a black uniform standing beside him' },
];

function buildFinalPrompt(sceneText) {
  // Mirrors the deleted generate-image-fal/route.ts's own finalPrompt
  // construction as closely as possible, so this test evaluates that
  // route's actual approach rather than a rewritten one.
  return "Digital painted illustration, painterly art style, " +
    "soft brush strokes, natural volumetric lighting, cinematic composition, " +
    "detailed background environment, illustrated but NOT a photograph. " +
    "Main subject: " + characterAnchor + ", realistic facial features preserved from reference, " +
    "painted in warm natural light. Scene: " + sceneText + ". " +
    "Style: high quality digital painting, concept art, story illustration. " +
    "Negative: photorealism, DSLR photo, 3D CGI, anime, chibi, flat colors, hard outlines, duplicates.";
}

function buildFalInput(sceneText, withIpAdapter) {
  const falInput = {
    prompt: buildFinalPrompt(sceneText),
    negative_prompt: "photograph, photorealistic, camera shot, DSLR, 3D CGI, Pixar, anime, chibi, duplicate person, clone, blurry, hard black outlines, flat colors",
    image_size: { width: 1024, height: 768 },
    num_inference_steps: 35,
    guidance_scale: 3.5,
    loras: [{ path: loraWeightsUrl, scale: isChild ? 0.88 : 0.80 }],
    num_images: 1,
    enable_safety_checker: false,
  };

  if (withIpAdapter) {
    falInput.ip_adapter = [{
      image_url: referenceImageUrl,
      scale: 0.7,
      model_type: "ip-adapter-faceid-plusv2",
    }];
  }

  return falInput;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runFal(falInput, seed) {
  const input = { ...falInput, seed };

  const submitRes = await fetch('https://queue.fal.run/fal-ai/flux-lora', {
    method: 'POST',
    headers: {
      'Authorization': 'Key ' + FAL_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  if (!submitRes.ok) {
    throw new Error('Submit failed: ' + submitRes.status + ' ' + (await submitRes.text()));
  }
  const submitData = await submitRes.json();
  console.log('  Submit response: ' + JSON.stringify(submitData));
  const statusUrl = submitData.status_url;
  const responseUrl = submitData.response_url;

  // Poll until COMPLETED.
  while (true) {
    await sleep(3000);
    const statusRes = await fetch(statusUrl, { headers: { 'Authorization': 'Key ' + FAL_KEY } });
    const statusData = await statusRes.json();
    console.log('  Status response: ' + JSON.stringify(statusData));
    if (statusData.status === 'COMPLETED') break;
    if (statusData.status === 'FAILED' || statusData.status === 'ERROR') {
      throw new Error('fal.ai request failed: ' + JSON.stringify(statusData));
    }
  }

  const resultRes = await fetch(responseUrl, { headers: { 'Authorization': 'Key ' + FAL_KEY } });
  const rawBody = await resultRes.text();
  // Full raw response body, always - regardless of whether it looks like
  // success or failure, so a shape we don't expect (e.g. an error field,
  // or images nested somewhere other than result.images[0].url) is visible
  // instead of silently producing "No image returned".
  console.log('  Result response (HTTP ' + resultRes.status + '): ' + rawBody);

  let result;
  try {
    result = JSON.parse(rawBody);
  } catch (err) {
    console.error('  Result body was not valid JSON: ' + err.message);
    return null;
  }
  return result?.images?.[0]?.url || null;
}

function downloadImage(url, filename) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filename);
    https.get(url, (res) => {
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
  });
}

async function main() {
  if (!FAL_KEY) {
    console.error('Set FAL_KEY in the environment before running (see the header comment for where to get one).');
    process.exit(1);
  }
  if (loraWeightsUrl === 'REPLACE_WITH_LORA_WEIGHTS_URL' || referenceImageUrl === 'REPLACE_WITH_REFERENCE_IMAGE_URL') {
    console.error('Fill in the CONFIG block at the top of this script before running.');
    process.exit(1);
  }

  for (const scene of scenes) {
    for (const withIpAdapter of [false, true]) {
      const label = (withIpAdapter ? 'ip' : 'noip') + '-' + scene.name;
      const falInput = buildFalInput(scene.text, withIpAdapter);
      const fullInput = { ...falInput, seed: scene.seed };

      console.log('\n=== ' + label + ' (seed: ' + scene.seed + ', ip_adapter: ' + withIpAdapter + ') ===');
      console.log(JSON.stringify(fullInput, null, 2));

      try {
        const imageUrl = await runFal(falInput, scene.seed);
        if (!imageUrl) {
          console.error('No image returned for ' + label);
          continue;
        }
        const filename = 'test-' + label + '.png';
        await downloadImage(imageUrl, filename);
        console.log('Saved ' + filename + ' (source: ' + imageUrl + ')');
      } catch (err) {
        console.error('Failed for ' + label + ':', err.message);
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
