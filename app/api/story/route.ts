import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const { prompt, secondaryName, secondaryTrigger } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: "API key missing" }), { status: 500 });

    const genAI = new GoogleGenerativeAI(apiKey);
    
    const companionInstruction = secondaryName && secondaryTrigger
      ? `There is also a companion in the story: ${secondaryTrigger}. You must include this companion in both the story narration (using their name: ${secondaryName}) and the image_prompt (describing them naturally, e.g. "standing with a golden retriever dog" or "hugging a cat").`
      : "There are no other main companions in this story.";

    const fullPrompt = `You are an expert comic book director. The user's idea is: "${prompt}".
      
      Primary character name: Simon (English trigger word is "TOK").
      ${companionInstruction}

      CRITICAL ANCHOR ANALYSIS:
      1. Identify the main character's name.
      2. STRICT DEFAULT TO ADULT RULE: You must default to portraying Simon as a fully grown adult man (around 30 years old, using "an adult man").
      3. Only use child descriptions if the user's prompt explicitly states they are a child (e.g. using words like "barn", "liten", "6 år").
      4. If the name is "Simon", he is ALWAYS a 30-year-old adult man. Do NOT make him a child even if "pappa" or "father" is mentioned in the prompt.
      5. If the user mentions "pappa" or "mamma", do NOT make Simon a child. Portray them as two adults (e.g., "Simon and his father Thomas, both adult men").

      CRITICAL RULES:
      1. "title" & "narration": Use the characters' REAL NAMES (Simon and others) in the narration. Write narration in the SAME LANGUAGE as the user's prompt.
      2. "image_prompt": Write in ENGLISH.
         - Comic book style: The style must be consistent graphic novel art.
         - CRITICAL ANCHOR RULE: Every single image_prompt MUST start exactly with: "Comic book panel illustration, graphic novel art, drawing of TOK, an adult man, " 
         - MULTI-CHARACTER RULE: If a companion is active (${secondaryName || 'none'}), you MUST describe them naturally in the image_prompt (e.g., "drawing of TOK, an adult man, standing with a golden retriever dog, on an airplane").
         - CRITICAL ISOLATION RULE: NEVER include other human characters in the image_prompt except Simon and the specified companion. Focus on the main characters to avoid AI confusion.
         - CRITICAL CAMERA RULE: Vary the camera angles freely (close-ups, medium shots, wide shots). Keep facial expressions simple (smiling, neutral, determined).
         
      Return ONLY a JSON object:
      {
        "title": "Title",
        "panels": [{ "panel_number": 1, "narration": "Text...", "image_prompt": "Comic book panel illustration, graphic novel art, drawing of TOK, an adult man, standing with a golden retriever, medium shot..." }]
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
      console.warn("gemini-2.5-flash är överbelastad (503), testar stabil fallback gemini-2.5-flash-lite...");
      
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
