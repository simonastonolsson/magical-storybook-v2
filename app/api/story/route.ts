import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const { prompt, secondaryName, secondaryTrigger } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: "API key missing" }), { status: 500 });

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Vi bestämmer inställningarna för din följeslagare (t.ex. Baran)
    const hasCompanion = !!(secondaryName && secondaryTrigger);
    const companionInfo = hasCompanion
      ? `Companion's Name: "${secondaryName}". Companion's Trigger Word: "COMPANIONTOK". Companion's Description: "${secondaryTrigger}".`
      : "No companion is selected.";

    const fullPrompt = `You are an expert comic book director. Create a comic book script based on the user's idea: "${prompt}".
      
      CHARACTERS:
      - Main Character: Simon (Trigger Word: "TOK", Description: "an adult man"). Simon is ALWAYS a 30-year-old adult man.
      - ${companionInfo}

      DIRECTOR RULES FOR WRITING:
      1. Create exactly 4 panels, numbered strictly 1, 2, 3, 4. (NEVER skip panel 1).
      2. Write "title" and panel "narration" in the SAME LANGUAGE as the user's prompt (Swedish in this case).
      3. Write "image_prompt" in ENGLISH.

      CRITICAL IMAGE_PROMPT RULES (Write in English, consistent graphic novel style):
      1. Every image_prompt MUST start exactly with: "Comic book panel illustration, graphic novel art, "
      2. Carefully decide who is in each scene and use the correct trigger words:
         - If Simon (TOK) is in the scene: include "drawing of TOK, an adult man".
         - If the companion (COMPANIONTOK) is in the scene: include "drawing of COMPANIONTOK, an adult man" (or the appropriate description like "drawing of COMPANIONTOK, a friendly golden retriever dog").
         - If BOTH Simon and the companion are in the scene: include "drawing of TOK, an adult man, and COMPANIONTOK, [COMPANION_DESCRIPTION]" together in the prompt so they appear in the same image.
         - If the scene is about a baby, or something else without Simon or the companion, describe it naturally (e.g., "drawing of a cute little baby wrapped in a blanket") and DO NOT include "TOK" or "COMPANIONTOK" in that prompt.
      3. Keep the scene composition simple and focused on the characters. Do not add other random people.
         
      Return ONLY a JSON object with this exact structure:
      {
        "title": "A beautiful title in the prompt's language",
        "panels": [
          {
            "panel_number": 1,
            "narration": "Narration text in the prompt's language...",
            "image_prompt": "Comic book panel illustration, graphic novel art, drawing of TOK, an adult man, and COMPANIONTOK, an adult man, standing together..."
          }
        ]
      }`;

    let result;
    try {
      // Försök först med gemini-2.5-flash
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash", 
        generationConfig: { responseMimeType: "application/json" }
      });
      result = await model.generateContent(fullPrompt);
    } catch (primaryError) {
      console.warn("gemini-2.5-flash är överbelastad, testar fallback gemini-2.5-flash-lite...");
      
      // Fallback till den stensäkra gemini-2.5-flash-lite
      const fallbackModel = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
        generationConfig: { responseMimeType: "application/json" }
      });
      result = await fallbackModel.generateContent(fullPrompt);
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
