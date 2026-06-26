import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: "API key missing" }), { status: 500 });

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // KORRIGERING: Vi använder gemini-2.5-flash som faktiskt fungerar!
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash", 
      generationConfig: { responseMimeType: "application/json" }
    });

    const fullPrompt = `You are an expert comic book director. The user's idea is: "${prompt}".
      First, identify the main character's name (e.g. Lovisa).
      Then, create a comic script with 4-5 panels.

      CRITICAL RULES:
      1. "title" & "narration": Use the character's REAL NAME (e.g., "Lovisa"). Write the narration in the SAME LANGUAGE as the user's prompt.
      2. "image_prompt": Write in ENGLISH.
         - You MUST use the special trigger word "a photo of TOK" to refer to the main character.
         - CRITICAL COLOR RULE: You must always describe the character with "blonde hair, light complexion" in every panel! (e.g. "a photo of TOK, a blonde woman, wearing...").
         - **CRITICAL CAMERA RULE:** You MUST vary camera angles. At least TWO panels must be a "close-up shot" or "medium shot" where the character's face is clearly visible. Use "wide shot" for the other panels.
         - Example for a close-up: "close-up shot of a photo of TOK, a young blonde woman, smiling, with the jungle in the background".
         - All image prompts must end with: ", comic book art, vibrant colors, detailed illustration".

      Return ONLY a JSON object:
      {
        "title": "The character's REAL NAME's Adventure",
        "panels": [{ "panel_number": 1, "narration": "Text with real name...", "image_prompt": "Image prompt with TOK..." }]
      }`;

    const result = await model.generateContent(fullPrompt);
    const comicData = JSON.parse(result.response.text());

    return new Response(JSON.stringify({ comic: comicData }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Story error:", error);
    return new Response(JSON.stringify({ error: "Failed to generate story" }), { status: 500 });
  }
}
