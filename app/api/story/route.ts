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

    const contents: any[] = [];
    contents.push(
      `You are an expert comic book director. Based on the user's idea: "${prompt}".
      Create a comic script with exactly 4 to 5 panels.
      
      CRITICAL RULES:
      1. "narration": Write story text in the EXACT SAME LANGUAGE as the user's prompt (e.g. Swedish).
      2. "image_prompt": Write in ENGLISH. 
         * YOU MUST use the exact trigger word "TOK" to refer to the main character in every single panel (e.g. "TOK smiling", "TOK dancing around a midsummer pole") to activate the AI face.
         * Keep the character consistent: TOK should have the same hair color and clothing style in all panels.
         * Vary the camera angles (wide shot, medium shot, action shot) and describe the environment in detail.
         * End all prompts with: "comic book illustration style, vibrant, highly detailed background".
      
      Return ONLY a JSON object:
      {
        "title": "Title",
        "panels": [{ "panel_number": 1, "narration": "Text...", "image_prompt": "Prompt..." }]
      }`
    );

    const result = await model.generateContent(contents);
    const comicData = JSON.parse(result.response.text());
    
    return new Response(JSON.stringify({ comic: comicData }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Story error:", error);
    return new Response(JSON.stringify({ error: "Failed to generate story" }), { status: 500 });
  }
}
