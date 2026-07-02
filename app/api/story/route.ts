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
      1. Create exactly 4 panels, numbered strictly 1, 2, 3, 4. (NEVER skip panel 1).
      2. Write "title" and panel "narration" in the SAME LANGUAGE as the user's prompt (Swedish in this case).
      3. Write "image_prompt" in ENGLISH.

      CRITICAL IMAGE_PROMPT RULES (Write in English, consistent graphic novel style):
      1. Every image_prompt MUST start exactly with: "Comic book panel illustration, graphic novel art, "
      2. You MUST use the correct trigger words and descriptions for who is actually in each scene:
         - If the main character (${name}) is in the scene: include "drawing of ${trigger}, ${desc}".
         - If the companion is in the scene: include "drawing of ${secondaryTriggerWord || 'COMPANIONTOK'}".
         - If BOTH are in the scene: describe them interacting in the same image (e.g., "drawing of ${trigger}, ${desc}, and ${secondaryTriggerWord || 'COMPANIONTOK'}, standing together").
         - If the scene is about a baby, an object, or something else where the main characters are not present: describe it naturally (e.g., "drawing of a cute little baby wrapped in a blanket") and DO NOT include "${trigger}" or "${secondaryTriggerWord || 'COMPANIONTOK'}" in that prompt.
      3. Keep the scene composition simple and focused on the characters. Do not add other random people.
         
      Return ONLY a JSON object with this exact structure:
      {
        "title": "A beautiful title in the prompt's language",
        "panels": [
          {
            "panel_number": 1,
            "narration": "Narration text in the prompt's language...",
            "image_prompt": "Comic book panel illustration, graphic novel art, drawing of ${trigger}, ${desc}, doing something..."
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
