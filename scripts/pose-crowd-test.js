// Standalone, one-off diagnostic script - NOT part of the production app,
// NOT wired into any route. Run manually only, when you're ready to spend
// real Replicate time/cost:
//
//   REPLICATE_API_TOKEN=your_token node scripts/pose-crowd-test.js
//
// Generates the SAME base scene (Bobban in football kit on a football
// field) four times with the SAME seed, varying ONLY two things in a 2x2
// matrix - pose (neutral vs. triumphant) and background (blurred
// teammates/opponents vs. a cheering crowd) - to isolate which variable
// (or combination) actually causes the "Pixar-glossy" look observed for
// the triumph+crowd combination, instead of comparing across different
// scenes/panels which can't isolate either variable on its own.
//
// Fill in the CONFIG block below with real values (from the Vercel logs
// for the actual panel you want to compare against) before running.

const Replicate = require('replicate');
const fs = require('fs');
const https = require('https');

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

// ---- CONFIG: fill these in with real values before running ----
const trainedModelId = 'REPLACE_WITH_MODEL_PATH'; // e.g. simonastonolsson/comic-hero-XXXX:versionhash
const triggerWord = 'BOBBANTOK';
const charDesc = 'a young boy';
const charOutfit = 'football kit, jersey and shorts'; // exact text this book actually used
const loraScale = 0.91; // held FIXED across all four - same value the real "Fotbollskladder" book used, so only pose/background text differs
const seed = 123456789; // any fixed number - identical across all four calls

// ---- digital_painting style block, copied from generate-image/route.ts -
// keep in sync by hand if that file's STYLE_PROMPTS.digital_painting changes ----
const style = {
  positive: "digital painted illustration, painterly art style, soft brush strokes, natural volumetric lighting, cinematic composition, detailed background environment, high quality digital painting, concept art, story illustration",
  negative: "photograph, photorealistic, DSLR, 3D CGI, Pixar, anime, chibi, flat colors, hard outlines, duplicates",
  qualityBoost: ", cinematic dramatic lighting, rich composition, vivid saturated colors, high quality detailed illustration",
  styleConsistency: ", consistent painterly illustration style, uniform artistic rendering throughout",
};

// Copied from generate-image/route.ts - only used here to decide whether
// backgroundDiversity text gets added, exactly like it would in a real
// generation call. Keep in sync by hand if that file's regex changes.
const multiPersonKeywords = /\b(crowd|crowds|spectator|spectators|audience|bystanders|onlookers|classmates|teammates|team-mates|team mates|players|other players|opposing team|opponents|skaters|other skaters|athletes|competitors|racers|dancers|singers|passengers|customers|guests|coworkers|colleagues|siblings|friends|family members|fans|cheering|stands|bleachers|stadium|arena|rink full of|group of|groups of|several people|many people|lots of people|dozens of|hundreds of|everyone|everybody|whole team|entire team|full team|packed (stands|arena|rink)|other (people|kids|children|students|players|skaters|athletes|teammates|racers|dancers|competitors)|companions|surrounded by|background characters|watching crowd|people watching)\b/i;

const identityReinforcement = ", character's exact childlike facial features and proportions preserved, do not age up";
// Same phrase added to every real panel generation since the cover-vs-panel
// composition fix - included here so this test matches real panel output
// as closely as possible, isolating ONLY pose/background as the variable.
const panelCompositionBoost = ", layered scene composition with atmospheric depth, high contrast dramatic staging";
const finalOutfit = "wearing " + charOutfit;
const characterAnchor = triggerWord + ', ' + charDesc + ', ' + finalOutfit;

const poses = {
  neutral: 'standing in a neutral, relaxed stance',
  triumph: 'arms raised in a triumphant pose',
};
const backgrounds = {
  blurred: 'his team and opponents blurred in the background',
  crowd: 'a cheering crowd in the distant background',
};

const combinations = [
  { name: 'neutral-blurred', pose: 'neutral', background: 'blurred' },
  { name: 'neutral-crowd', pose: 'neutral', background: 'crowd' },
  { name: 'triumph-blurred', pose: 'triumph', background: 'blurred' },
  { name: 'triumph-crowd', pose: 'triumph', background: 'crowd' },
];

function buildFinalPrompt(poseKey, backgroundKey) {
  // Mirrors generate-image/route.ts's finalPrompt construction exactly,
  // varying only the pose/background clauses inside the Scene: portion.
  const cleanedPrompt = 'waist-up medium shot of ' + triggerWord + ', ' + charDesc + ', ' + finalOutfit +
    ', playing football on a football field, ' + poses[poseKey] + ', ' + backgrounds[backgroundKey];

  const backgroundDiversity = multiPersonKeywords.test(cleanedPrompt)
    ? ", background characters have diverse and varied faces, different from the protagonist, unrelated bystanders with distinct individual appearances"
    : "";

  return "Main subject: " + characterAnchor + ", realistic facial features preserved from reference photos. " +
    "Full unobstructed view of character's entire head and hair, vertical portrait framing, ample headroom, character never cropped at top of frame. " +
    style.positive + ". Scene: " + cleanedPrompt +
    ". The character must wear exactly: " + finalOutfit + " in this scene, outfit must not change, protagonist's full head and hair must remain fully visible even in crowd or group scenes, do not crop the main character's head to fit background characters" +
    identityReinforcement + backgroundDiversity + style.qualityBoost + panelCompositionBoost + style.styleConsistency;
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

  for (const combo of combinations) {
    const finalPrompt = buildFinalPrompt(combo.pose, combo.background);
    console.log('\n=== ' + combo.name + ' (pose: "' + poses[combo.pose] + '", background: "' + backgrounds[combo.background] + '") ===');
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
      console.error('No image returned for combination ' + combo.name);
      continue;
    }
    const filename = 'test-' + combo.name + '.png';
    await downloadImage(imageUrl, filename);
    console.log('Saved ' + filename + ' (source: ' + imageUrl + ')');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
