import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const { 
      prompt, 
      characterName, 
      characterTrigger, 
      characterDescription,
      secondaryName, 
      secondaryTrigger,
      secondaryTriggerWord
    } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: "API key missing" }), { status: 500 });

    const genAI = new GoogleGenerativeAI(apiKey);
    
    const name = characterName || "Simon";
    const trigger = characterTrigger || "TOK";
    const desc = characterDescription || "an adult man";

    const companionInstruction = secondaryName && secondaryTrigger && secondaryTriggerWord
      ? `There is also a companion in the story: ${secondaryTrigger}. 
         The companion's Name is "${secondaryName}".
         The companion's UNIQUE Trigger Word is "${secondaryTriggerWord}".
         You MUST include this companion in both the story narration (using their name: ${secondaryName}) and the image_prompt (using their unique trigger word: "${secondaryTriggerWord}").`
      : "There are no other main companions in this story.";

    const fullPrompt = `You are an expert comic book director. Create a dynamic comic book script based on the user's idea: "${prompt}".
      
      CHARACTERS TO PORTRAY:
      - Main Character: Name is "${name}". UNIQUE Trigger Word is "${trigger}". Appearance is "${desc}".
      - ${companionInstruction}

      DIRECTOR RULES FOR WRITING (CRITICAL FOR NARRATIVE FLOW & VARIATION):
      1. Create exactly 16 panels, numbered strictly 1 to 16. Do not skip any panel, do not collapse any panels.
      2. Write "title" and panel "narration" in the SAME LANGUAGE as the user's prompt (Swedish in this case).
      3. Write "image_prompt" in ENGLISH.
      4. VARIETY, POSING & THE "FOURTH WALL" RULE (CRITICAL):
         - The main characters must NOT just stand and pose as fashion models. They must be actively doing things (e.g. flying a hot air balloon, walking down a street, shopping, unboxing moving boxes).
         - DIRECT EYE CONTACT / CAMERA LOOKING: By default (85% of the time), characters must look at each other, at their environment, or be in profile view. However, you are allowed to have a character look directly at the camera/viewer to "break the fourth wall" for emotional impact (e.g., looking surprised at a match, smiling directly at the reader to share a secret thought). This must be used very sparingly (MAXIMUM 1-2 times in the entire 16-panel story).
         - Vary the perspectives: Use profile views (sidoprofil), three-quarter views, over-the-shoulder, or views from behind (e.g. looking at a city).
         - Extras & crowds: You are allowed and encouraged to include other background people naturally (e.g. "shoppers in a clothing store", "crowds on a street", "other passengers", "bystanders") to make the scenes feel alive, but keep the main characters ${name} and the companion as the clear focal points.

      CRITICAL IMAGE_PROMPT RULES (Write in English, consistent graphic novel style):
      1. Every image_prompt MUST start exactly with: "Comic book panel illustration, graphic novel art, "
      2. CAMERA FRAMING RULE: 
         - Always use explicit out-zooming and perspective descriptions: "wide angle", "shot from a distance", "establishing shot", "action shot", "three-quarter body shot showing the characters engaged in...", "side profile", "view from behind".
         - NEVER use extreme close-ups or pose-like framing. Ensure substantial empty headroom above the characters' hair so they are never cropped out.
      3. Use the correct trigger words and descriptions naturally inside the actions:
         - If only ${name} is in the scene: include "drawing of ${trigger}, ${desc}, [DOING SOME SPECIFIC ACTION]". Define clearly where he is looking (e.g., "looking away from the camera", "looking down at his phone", or very rarely "looking at the camera with a surprised expression").
         - If only the companion is in the scene: include "drawing of ${secondaryTriggerWord || 'COMPANIONTOK'}, [DOING SOME SPECIFIC ACTION]".
         - If BOTH are in the scene: include them together, interacting or doing an activity (e.g., "drawing of ${trigger}, ${desc}, and ${secondaryTriggerWord || 'COMPANIONTOK'}, both in profile view, laughing and talking together while [DOING SOME SPECIFIC ACTION]").
         - If the scene is about a baby, an object, or something else where the main characters are not present: describe it naturally (e.g., "drawing of a cute little baby wrapped in a blanket, medium shot") and DO NOT include "${trigger}" or "${secondaryTriggerWord || 'COMPANIONTOK'}" in that prompt.
         
      Return ONLY a JSON object with this exact structure:
      {
        "title": "A beautiful title in the prompt's language",
        "panels": [
          {
            "panel_number": 1,
            "narration": "Narration text in the prompt's language...",
            "image_prompt": "Comic book panel illustration, graphic novel art, wide-angle action shot from a distance of the first subject ${trigger}, ${desc}, with substantial empty headroom, looking away from the camera, engaged in..."
          }
        ]
      }`;

    let result;
    try {
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash", 
        generationConfig: { responseMimeType: "application/json" }
      });
      result = await model.generateContent(fullPrompt);
    } catch (primaryError) {
      console.warn("gemini-2.5-flash är överbelastad, testar fallback gemini-2.5-flash-lite...");
      try {
        const fallbackModel = genAI.getGenerativeModel({
          model: "gemini-2.5-flash-lite",
          generationConfig: { responseMimeType: "application/json" }
        });
        result = await fallbackModel.generateContent(fullPrompt);
      } catch (secondaryError) {
        const premiumModel = genAI.getGenerativeModel({
          model: "gemini-2.5-pro",
          generationConfig: { responseMimeType: "application/json" }
        });
        result = await premiumModel.generateContent(fullPrompt);
      }
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
