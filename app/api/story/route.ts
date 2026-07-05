import { GoogleGenerativeAI } from "@google/generative-ai";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(req: Request) {
  try {
    const {
      prompt,
      characterName,
      characterTrigger,
      characterDescription,
      secondaryName,
      secondaryTrigger,
      secondaryTriggerWord,
      pageCount
    } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: "API key missing" }), { status: 500 });

    const genAI = new GoogleGenerativeAI(apiKey);

    const name = characterName || "Simon";
    const trigger = characterTrigger || "TOK";
    const desc = characterDescription || "an adult man";
    const finalPageCount = pageCount || 12;

    const isChild = desc.toLowerCase().includes("boy") ||
                    desc.toLowerCase().includes("girl") ||
                    desc.toLowerCase().includes("child") ||
                    desc.toLowerCase().includes("baby");

    const signatureOutfit = isChild
      ? "wearing his signature cozy yellow storybook raincoat and blue denim jeans"
      : "wearing his signature classic navy blue sweater and dark grey trousers";

    const companionInstruction = secondaryName && secondaryTrigger && secondaryTriggerWord
      ? `There is also a companion in the story: ${secondaryTrigger}.
         The companion's Name is "${secondaryName}".
         The companion's UNIQUE Trigger Word is "${secondaryTriggerWord}".
         You MUST include this companion in both the story narration (using their name: ${secondaryName}) and the image_prompt (using their unique trigger word: "${secondaryTriggerWord}").`
      : "There are no other main companions in this story.";

    const fullPrompt = `You are an expert comic book director. Create a dynamic comic book script based on the user's idea: "${prompt}".

      CHARACTERS TO PORTRAY:
      - Main Character: Name is "${name}". UNIQUE Trigger Word is "${trigger}". Appearance is "${desc}".
      - Main Character Signature Outfit (MUST BE USED IN EVERY PANEL): "${signatureOutfit}".
      - ${companionInstruction}

      DIRECTOR RULES FOR WRITING (CRITICAL FOR NARRATIVE FLOW AND RESEMBLANCE CONSISTENCY):
      1. Create exactly ${finalPageCount} panels, numbered strictly 1 to ${finalPageCount}. Do not skip any panel, do not collapse any panels, and output EXACTLY ${finalPageCount} panels total.
      2. Write "title" and panel "narration" in the SAME LANGUAGE as the user's prompt (Swedish in this case).
      3. Write "image_prompt" in ENGLISH.
      4. CAMERA ANGLES FOR PERFECT LIKENESS (STRICT CONSISTENCY RULE):
         - Avoid extreme angles: Do NOT use low-angles looking straight up, do NOT use high-angles looking straight down, and do NOT use strict profile views (side profiles).
         - Always write prompts specifying a "three-quarter face view" or "waist-up three-quarter shot" whenever depicting ${trigger} face. This is the optimal angle for facial resemblance.
         - Ensure characters look active, engaged, and are looking slightly away from the camera into their action, never directly into the lens.
      5. OUTFIT LOCKING (STRICT CONSISTENCY RULE):
         - You MUST include ${trigger} and his exact signature outfit "${signatureOutfit}" in the image_prompt of EVERY SINGLE PANEL. His clothes must NEVER change, not even for sleeping or active scenes. This is the visual red thread of the book.
      6. CLONE PREVENTION (CRITICAL - READ CAREFULLY):
         - Each image_prompt must contain the trigger word "${trigger}" EXACTLY ONCE. Never repeat it in the same prompt.
         - If the companion is in the scene, use their trigger word EXACTLY ONCE as well.
         - Writing a trigger word twice in one prompt will cause the AI to draw two copies of the same character. This is forbidden.
         - Double-check every image_prompt before writing it: count how many times "${trigger}" appears and ensure it is exactly 1.

      CRITICAL IMAGE_PROMPT RULES (Write in English, consistent watercolor storybook style):
      1. Every image_prompt MUST start exactly with: "Comic book panel illustration, graphic novel art, "
      2. CAMERA FRAMING RULE:
         - Always use explicit out-zooming descriptions: "wide angle", "shot from a distance", "establishing shot", "action shot", "three-quarter body shot showing the characters engaged in...", "three-quarter face view".
         - Ensure substantial empty headroom above the characters hair so they are never cropped out.
      3. Use the correct trigger words and descriptions naturally inside the actions:
         - If only ${name} is in the scene: include "drawing of ${trigger}, ${desc}, ${signatureOutfit}, three-quarter face view, looking away from the camera, [DOING SOME SPECIFIC ACTION]".
         - If BOTH are in the scene: include them together, interacting or doing an activity (e.g., "drawing of ${trigger}, ${desc}, ${signatureOutfit}, and ${secondaryTriggerWord || "COMPANIONTOK"}, both in three-quarter view, laughing and talking together while [DOING SOME SPECIFIC ACTION]").

      Return ONLY a JSON object with this exact structure:
      {
        "title": "A beautiful title in the prompts language",
        "panels": [
          {
            "panel_number": 1,
            "narration": "Narration text in the prompts language...",
            "image_prompt": "Comic book panel illustration, graphic novel art, wide-angle action shot from a distance of the first subject ${trigger}, ${desc}, ${signatureOutfit}, three-quarter face view, with substantial empty headroom, looking away from the camera, engaged in..."
          }
        ]
      }`;

    let result;
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-flash",
          generationConfig: { responseMimeType: "application/json" }
        });
        result = await model.generateContent(fullPrompt);
        break;
      } catch (error: any) {
        attempt++;
        console.warn(`Attempt ${attempt} failed with error: ${error.message || error}`);
        if (attempt >= maxRetries) {
          throw error;
        }
        const waitTime = attempt * 1500;
        console.warn(`Waiting ${waitTime}ms before retry...`);
        await delay(waitTime);
      }
    }

    if (!result) {
      throw new Error("Failed to generate story after multiple retries");
    }

    let text = result.response.text();
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    text = text.replace(/\/\/.*$/gm, "");
    text = text.replace(/,\s*([\]}])/g, "$1");

    const comicData = JSON.parse(text);

    return new Response(JSON.stringify({ comic: comicData }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Story error:", error);
    return new Response(JSON.stringify({ error: "Failed to generate story" }), { status: 500 });
  }
}
