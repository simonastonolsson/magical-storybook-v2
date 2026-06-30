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
      First, identify the main character's name.
      Then, create a comic script with 4-5 panels.

      CRITICAL RULES:
      1. "title" & "narration": Use the character's REAL NAME. Write narration in the SAME LANGUAGE as the user's prompt.
      2. "image_prompt": Write in ENGLISH.
         - CRITICAL STYLE RULE: Every single image_prompt MUST start exactly with: "Comic book panel illustration, graphic novel art, drawing of TOK, "
         - CRITICAL APPEARANCE RULE: NEVER describe the character's hair color, gender, or facial features (do NOT write "blonde", "man", "woman", etc.). Just use "TOK" and let the AI handle the face. Focus ONLY on clothing, action, and environment.
         - CRITICAL FACE RULE: Keep facial expressions simple (smiling, neutral, determined).
         - CRITICAL CAMERA RULE: Vary the camera angles freely (close-ups, medium shots, wide shots). 
         
      Return ONLY a JSON object:
      {
        "title": "Title",
        "panels": [{ "panel_number": 1, "narration": "Text...", "image_prompt": "Comic book panel illustration, graphic novel art, drawing of TOK, wearing a casual shirt, medium shot..." }]
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
