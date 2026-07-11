// Standalone, one-off diagnostic script - NOT part of the production app,
// NOT wired into any route. Run manually only, when you're ready to spend
// real Replicate time/cost:
//
//   REPLICATE_API_TOKEN=your_token node scripts/framing-test.js
//
// Generates the SAME scene three times with the SAME seed, changing ONLY
// the leading framing phrase, to isolate whether "medium close-up"
// specifically causes the "Pixar-glossy" look observed vs the "waist-up..."
// framings - instead of comparing across different scenes/panels, which
// can't isolate the framing variable on its own.
//
// Fill in the CONFIG block below with real values (from the Vercel logs for
// the actual panel you want to compare against) before running.

const Replicate = require('replicate');
const fs = require('fs');
const https = require('https');

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

// ---- CONFIG: fill these in with real values before running ----
const trainedModelId = 'REPLACE_WITH_MODEL_PATH'; // e.g. simonastonolsson/comic-hero-XXXX:versionhash
const triggerWord = 'BOBBANTOK';
const charDesc = 'a young boy';
const charOutfit = 'jeans and a cozy sweater, round neckline'; // exact text this book actually used
const loraScale = 0.80; // use the SAME value the real panel 3 log line showed for "lora_scale used"
const seed = 123456789; // any fixed number - identical across all three calls, so only framing differs
// Fill in with the rest of panel 3's actual scene text (from the "Tested
// against:" log line), minus whatever framing phrase Gemini originally used
// at the start of it - e.g. if the log showed "waist-up medium shot of
// BOBBANTOK, a young boy, ..., energetically kicking a football across the
// moon's surface, craters and stars visible in the background", paste
// everything after "of BOBBANTOK, a young boy, wearing ..., " below:
const sceneCore = "energetically kicking a football across the moon's surface, craters and stars visible in the background";

// ---- digital_painting style block, copied from generate-image/route.ts -
// keep in sync by hand if that file's STYLE_PROMPTS.digital_painting changes ----
const style = {
  positive: "digital painted illustration, painterly art style, soft brush strokes, natural volumetric lighting, cinematic composition, detailed background environment, high quality digital painting, concept art, story illustration",
  negative: "photograph, photorealistic, DSLR, 3D CGI, Pixar, anime, chibi, flat colors, hard outlines, duplicates",
  qualityBoost: ", cinematic dramatic lighting, rich composition, vivid saturated colors, high quality detailed illustration",
  styleConsistency: ", consistent painterly illustration style, uniform artistic rendering throughout",
};

const identityReinforcement = ", character's exact childlike facial features and proportions preserved, do not age up";
const finalOutfit = "wearing " + charOutfit;
const characterAnchor = triggerWord + ', ' + charDesc + ', ' + finalOutfit;

const framingVariants = [
  { name: 'closeup', phrase: 'medium close-up' },
  { name: 'threequarter', phrase: 'waist-up three-quarter shot' },
  { name: 'waistup', phrase: 'waist-up medium shot' },
];

function buildFinalPrompt(framingPhrase) {
  // Mirrors generate-image/route.ts's finalPrompt construction exactly,
  // varying only the framing phrase inside the Scene: portion.
  const cleanedPrompt = framingPhrase + ' of ' + triggerWord + ', ' + charDesc + ', ' + finalOutfit + ', ' + sceneCore;
  return "Main subject: " + characterAnchor + ", realistic facial features preserved from reference photos. " +
    "Full unobstructed view of character's entire head and hair, vertical portrait framing, ample headroom, character never cropped at top of frame. " +
    style.positive + ". Scene: " + cleanedPrompt +
    ". The character must wear exactly: " + finalOutfit + " in this scene, outfit must not change, protagonist's full head and hair must remain fully visible even in crowd or group scenes, do not crop the main character's head to fit background characters" +
    identityReinforcement + style.qualityBoost + style.styleConsistency;
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
  if (trainedModelId === 'REPLACE_WITH_MODEL_PATH') {
    console.error('Fill in the CONFIG block at the top of this script before running.');
    process.exit(1);
  }

  for (const variant of framingVariants) {
    const finalPrompt = buildFinalPrompt(variant.phrase);
    console.log('\n=== ' + variant.name + ' ("' + variant.phrase + '") ===');
    console.log(finalPrompt);

    const input = {
      prompt: finalPrompt,
      negative_prompt: style.negative + ", wrong outfit, different clothes, clone, duplicate face, cloned face, same face repeated on multiple people, identical twins in background, multiple people with same appearance",
      width: 1024,
      height: 1152,
      num_inference_steps: 35,
      guidance_scale: 3.5,
      lora_scale: loraScale,
      seed: seed,
    };

    const output = await replicate.run(trainedModelId, { input });
    const imageUrl = Array.isArray(output) && output.length > 0 ? output[0] : null;
    if (!imageUrl) {
      console.error('No image returned for variant ' + variant.name);
      continue;
    }
    const filename = 'test-' + variant.name + '.png';
    await downloadImage(imageUrl, filename);
    console.log('Saved ' + filename + ' (source: ' + imageUrl + ')');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
