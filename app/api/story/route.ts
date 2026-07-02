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

    // Vi ger Gemini instruktionen att tydligt beskriva hår/kläder/ansikte för båda karaktärerna
    // baserat på referensbildernas placering i listan. Detta förhindrar att ansiktena blandas ihop!
    const companionInstruction = secondaryName && secondaryTrigger
      ? `There is also a companion in the story: "${secondaryName}".
         CRITICAL REFERENCE MAPPING FOR NANO BANANA 2:
         - The main character (${name}) is shown in the FIRST 3 images of the image_input list.
         - The companion (${secondaryName}) is shown in the NEXT 3 images of the image_input list.
         In the "image_prompt", you MUST describe both of them with distinct physical features (e.g. hair color, clothes) 
         and link them explicitly to their reference positions (e.g., "drawing of the man shown in the first 3 reference images, who is Simon, ${desc}, standing next to the man shown in the next 3 reference images, who is ${secondaryName}...").`
      : `The main character (${name})'s face is shown in the reference images. Refer to them explicitly as "the subject shown in the first reference images, ${desc}".`;

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
      2. You MUST use the correct reference pointers and physical details for who is actually in each scene:
         - If only ${name} is in the scene: include "drawing of the subject shown in the first reference images, ${desc}, with short brown hair".
         - If only the companion (${secondaryName || 'none'}) is in the scene: include "drawing of the second subject shown in the reference images, an adult man with dark hair".
         - If BOTH are in the scene: describe both interacting using the explicit pointers (e.g., "drawing of the first subject shown in the reference images, ${desc}, standing next to the second subject shown in the reference images, who is an adult man with dark hair").
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
