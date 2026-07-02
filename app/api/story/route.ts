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

    const fullPrompt = `You are an expert comic book director. Create a comic book script based on the user's idea: "${prompt}".
      
      CHARACTERS TO PORTRAY:
      - Main Character: Name is "${name}". UNIQUE Trigger Word is "${trigger}". Appearance is "${desc}".
      - ${companionInstruction}

      DIRECTOR RULES FOR WRITING:
      1. Create exactly 16 panels, numbered strictly 1, 2, 3, ..., 16. (NEVER skip panel 1, and always output exactly 16 panels).
      2. Write "title" and panel "narration" in the SAME LANGUAGE as the user's prompt (Swedish in this case).
      3. Write "image_prompt" in ENGLISH.

      CRITICAL IMAGE_PROMPT RULES (Write in English, consistent graphic novel style):
      1. Every image_prompt MUST start exactly with: "Comic book panel illustration, graphic novel art, "
      
      2. CAMERA FRAMING RULE (CRITICAL FOR OUT-ZOOMING):
         - You MUST use explicit out-zooming anchors in every prompt: "shot from a distance, wide angle lens, three-quarter body shot showing the character from the waist up, substantial empty space above the head, room above hair".
         - STRICTLY PROHIBIT CLOSE-UPS: Never use "close-up", "face portrait", or "cropped shot". The character's head and hair must NEVER touch the top edge of the frame. There must always be at least 15% empty background space above the characters' heads.
         
      3. You MUST use the correct trigger words and descriptions for who is actually in each scene:
         - If only ${name} is in the scene: include "drawing of ${trigger}, ${desc}, shot from a distance, showing him from the waist up with plenty of head room".
         - If only the companion is in the scene: include "drawing of ${secondaryTriggerWord || 'COMPANIONTOK'}, shot from a distance, showing them from the waist up with plenty of head room".
         - If BOTH are in the scene: describe them interacting in the same image (e.g., "drawing of ${trigger}, ${desc}, and ${secondaryTriggerWord || 'COMPANIONTOK'}, sitting together, shot from a distance, wide angle, showing both from the waist up with plenty of empty space above their heads").
         - If the scene is about a baby, an object, or something else where the main characters are not present: describe it naturally (e.g., "drawing of a cute little baby wrapped in a blanket, medium shot") and DO NOT include "${trigger}" or "${secondaryTriggerWord || 'COMPANIONTOK'}" in that prompt.
      4. Keep the scene composition simple and focused on the characters. Do not add other random people.
         
      Return ONLY a JSON object with this exact structure:
      {
        "title": "A beautiful title in the prompt's language",
        "panels": [
          {
            "panel_number": 1,
            "narration": "Narration text in the prompt's language...",
            "image_prompt": "Comic book panel illustration, graphic novel art, drawing of ${trigger}, ${desc}, shot from a distance, three-quarter body shot showing him from the waist up with substantial empty space above his head, doing something..."
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
