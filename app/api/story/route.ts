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
      
      CRITICAL ANALYSIS RULE:
      1. Carefully analyze the user's prompt to identify the main character's age and gender (e.g., adult man, adult woman, young boy, young girl, elderly man, etc.).
      2. NEVER assume or guess the age. If the prompt mentions "Simon", look for cues. If Simon is the creator/adult, portray him as a fully grown adult man. If the prompt mentions a child, son, or young age (e.g., "Ville 6 år"), portray them exactly as that age.
      3. Use this identified gender and age to create the perfect "anchor description" (e.g. "an adult man", "a young boy", "a young girl", "an adult woman").

      CRITICAL RULES:
      1. "title" & "narration": Use the character's REAL NAME. Write narration in the SAME LANGUAGE as the user's prompt.
      2. "image_prompt": Write in ENGLISH.
         - CRITICAL ANCHOR RULE: Every single image_prompt MUST start exactly with: "Comic book panel illustration, graphic novel art, drawing of TOK, [ANCHOR_DESCRIPTION], " (Replace [ANCHOR_DESCRIPTION] with the identified age and gender, e.g., "an adult man" or "a young boy").
         - CRITICAL ISOLATION RULE: NEVER include other human characters in the image_prompt. Focus 100% on TOK to avoid AI confusion.
         - CRITICAL CAMERA RULE: Vary the camera angles freely (close-ups, medium shots, wide shots). Keep facial expressions simple (smiling, neutral, determined).
         
      Return ONLY a JSON object:
      {
        "title": "Title",
        "panels": [{ "panel_number": 1, "narration": "Text...", "image_prompt": "Comic book panel illustration, graphic novel art, drawing of TOK, an adult man, wearing a jacket, medium shot..." }]
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
