import { GoogleGenerativeAI } from "@google/generative-ai";

// Hjälpfunktion för att vänta x millisekunder
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
      4. VARIETY & ACTION (STRICT RULE): The main characters must NOT just stand and pose or look at the camera. They should be active, looking at each other, looking at things in their environment, or engaged in actions.
         - Vary the compositions: Some panels must be wide shots showing them from a distance doing an activity (e.g. flying a hot air balloon, walking down a street, shopping, carrying boxes).
         - Vary the perspectives: Use profile views (sidoprofil), three-quarter views, over-the-shoulder, or views from behind (e.g. looking at a city).
         - Characters must NEVER look directly at the camera/viewer. They should look at each other, at objects, or ahead into their action.
         - Extras & crowds: You are allowed and encouraged to include other background people naturally (e.g. "shoppers in a clothing store", "crowds on a street", "other passengers", "bystanders") to make the scenes feel alive, but keep the main characters ${name} and the companion as the clear focal points.

      CRITICAL IMAGE_PROMPT RULES (Write in English, consistent graphic novel style):
      1. Every image_prompt MUST start exactly with: "Comic book panel illustration, graphic novel art, "
      2. CAMERA FRAMING RULE: 
         - Always use explicit out-zooming and perspective descriptions: "wide angle", "shot from a distance", "establishing shot", "action shot", "three-quarter body shot showing the characters engaged in...", "side profile", "view from behind".
         - NEVER use close-ups or pose-like framing. Ensure substantial empty headroom above the characters' hair so they are never cropped out.
      3. Use the correct trigger words and descriptions naturally inside the actions:
         - If only ${name} is in the scene: include "drawing of ${trigger}, ${desc}, looking away from the camera, [DOING SOME SPECIFIC ACTION]".
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

    // NYCKELN FÖR SKOTTSÄKER DRIFT (Retry på gemini-2.5-flash):
    // Eftersom gemini-2.5-pro har en stenhård begränsning på 0 requests på Free Tier (429),
    // och 503 High Demand på Flash nästan alltid är tillfällig, så kör vi automatisk retry på Flash!
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
        break; // Om det lyckas bryter vi loopen direkt!
      } catch (error: any) {
        attempt++;
        console.warn(`Attempt ${attempt} failed with error: ${error.message || error}`);
        if (attempt >= maxRetries) {
          throw error; // Om vi nått maxgränsen kastar vi felet vidare
        }
        // Vänta lite längre för varje misslyckat försök (exponential backoff: 1.5s, 3s)
        const waitTime = attempt * 1500;
        console.warn(`Waiting ${waitTime}ms before retry...`);
        await delay(waitTime);
      }
    }

    if (!result) {
      throw new Error("Failed
