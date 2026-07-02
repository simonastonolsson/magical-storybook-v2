import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const { 
      prompt, 
      characterName, 
      characterTrigger, 
      characterDescription,
      secondaryName, 
      secondaryTrigger 
    } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: "API key missing" }), { status: 500 });

    const genAI = new GoogleGenerativeAI(apiKey);
    
    const name = characterName || "Simon";
    const trigger = characterTrigger || "TOK";
    const desc = characterDescription || "an adult man";

    // Skapa en tydlig instruktion för hur referensbilderna är sorterade i listan!
    // På framsidan skickar vi alltid Simon först (t.ex. bild 0-2) och kompisen sen (t.ex. bild 3-5).
    const companionInstruction = secondaryName && secondaryTrigger
      ? `There is also a companion in the story: "${secondaryName}".
         CRITICAL REFERENCE MAPPING:
         - The main character (${name})'s face is shown in the FIRST 3 images of the reference array.
         - The companion (${secondaryName})'s face is shown in the NEXT 3 images of the reference array.
         You MUST explicitly refer to this in the image_prompts so the AI model knows who is who (e.g. "Simon (represented by the first subject in the reference images) and Baran (represented by the second subject in the reference images)...").`
      : `The main character (${name})'s face is shown in the reference images. Refer to them as "the subject shown in the reference images".`;

    const fullPrompt = `You are an expert comic book director. Create a comic book script based on the user's idea: "${prompt}".
      
      CHARACTERS TO PORTRAY:
      - Main Character: Name is "${name}". Trigger Word is "${trigger}". Appearance is "${desc}".
      - ${companionInstruction}

      DIRECTOR RULES FOR WRITING:
      1. Create exactly 4 panels, numbered strictly 1, 2, 3, 4. (NEVER skip panel 1).
      2. Write "title" and panel "narration" in the SAME LANGUAGE as the user's prompt (Swedish in this case).
      3. Write "image_prompt" in ENGLISH.

      CRITICAL IMAGE_PROMPT RULES (Write in English, consistent graphic novel style):
      1. Every image_prompt MUST start exactly with: "Comic book panel illustration, graphic novel art, "
      2. You MUST use the correct reference pointers for who is actually in each scene:
         - If only ${name} is in the scene: include "drawing of the first subject in the reference images, ${desc}".
         - If only the companion (${secondaryName || 'none'}) is in the scene: include "drawing of the second subject in the reference images" (or describe them based on their description).
         - If BOTH are in the scene: describe them interacting in the same image using the explicit pointers (e.g. "drawing of the first subject in the reference images, ${desc}, and the second subject in the reference images, standing together").
         - If the scene is about a baby, an object, or something else where the main characters are not present: describe it naturally (e.g., "drawing of a cute little baby wrapped in a blanket") and DO NOT refer to the reference images.
      3. Keep the scene composition simple and focused on the characters. Do not add other random people.
         
      Return ONLY a JSON object with this exact structure:
      {
        "title": "A beautiful title in the prompt's language",
        "panels": [
          {
            "panel_number": 1,
            "narration": "Narration text in the prompt's language...",
            "image_prompt": "Comic book panel illustration, graphic novel art, drawing of the first subject in the reference images, ${desc}, doing something..."
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
