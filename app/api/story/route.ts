import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: "API key missing" }), { status: 500 });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash", 
      generationConfig: { responseMimeType: "application/json" }
    });

    const contents: any[] = [];
    contents.push(
      `You are an expert comic book director. The user's idea is: "${prompt}".
      First, identify the main character's name. Then create a 4-5 panel comic script.

      CRITICAL RULES:
      1. "title" & "narration": Use the character's REAL NAME (e.g., Simon). Write narration in the SAME LANGUAGE as the user's prompt.
      2. "image_prompt": Write in ENGLISH. 
         - CRITICAL: You MUST start every prompt with the exact word "TOK".
         - NEVER describe the character's face, hair color, or facial hair (e.g., NEVER write "bearded man" or "brown hair"). The AI already knows what TOK looks like!
         - Focus ONLY on their clothes, actions, and the environment.
         - Example: "TOK wearing a blue jacket, riding a bicycle on a dirt road. Comic book style, vibrant."
      
      Return ONLY a JSON object:
      {
        "title": "Title",
        "panels": [{ "panel_number": 1, "narration": "...", "image_prompt": "..." }]
      }`
    );

    const result = await model.generateContent({ contents });
    const comicData = JSON.parse(result.response.text());
    return new Response(JSON.stringify({ comic: comicData }), { headers: { "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Story error:", error);
    return new Response(JSON.stringify({ error: "Failed to generate story" }), { status: 500 });
  }
}
