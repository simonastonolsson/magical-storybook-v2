import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: "API key missing" }), { status: 500 });

    const genAI = new GoogleGenerativeAI(apiKey);
    
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash", 
      generationConfig: { responseMimeType: "application/json" }
    });

    const fullPrompt = `You are an expert comic book director. The user's idea is: "${prompt}".
      First, identify the main character's name from the user's prompt (e.g. Lovisa).
      Then, create a comic script with 4-5 panels.

      CRITICAL RULES:
      1. "title" & "narration": Use the character's REAL NAME (e.g., "Lovisa"). Write the narration in the SAME LANGUAGE as the user's prompt (e.g., Swedish).
      2. "image_prompt": Write in ENGLISH.
         - You MUST use the special trigger word "a photo of TOK" to refer to the main character. NEVER use the real name in the image prompt.
         - CRITICAL COLOR RULE: You must always describe the character with "blonde hair, light complexion" in every panel! (e.g. "a photo of TOK, a blonde woman, wearing...").
         - NEVER describe her with dark hair, and make sure to specify her hair is blonde.
         - Describe the action and environment. Use varied camera angles (wide shot, action shot).
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
