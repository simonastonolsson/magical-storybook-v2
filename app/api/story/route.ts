import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const { prompt, secondaryName, secondaryTrigger } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: "API key missing" }), { status: 500 });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash", 
      generationConfig: { responseMimeType: "application/json" }
    });

    // Vi berättar för Gemini om den extra karaktären finns med
    const secondaryInfo = secondaryName && secondaryTrigger 
      ? `There is also an optional secondary character: Name is "${secondaryName}", English trigger word is "${secondaryTrigger}".`
      : "";

    const fullPrompt = `You are an expert comic book director. The user's idea is: "${prompt}".
      
      Primary character name: Simon (English trigger word is "TOK").
      ${secondaryInfo}

      CRITICAL ANCHOR ANALYSIS:
      1. Portray Simon as a fully grown adult man ("an adult man") unless the prompt explicitly says otherwise.
      2. If a secondary character is provided, identify if they are a man, woman, dog, etc.

      CRITICAL RULES:
      1. "title" & "narration": Use the characters' REAL NAMES (Simon and ${secondaryName || ''}) in the narration. Write narration in the SAME LANGUAGE as the user's prompt.
      2. "image_prompt": Write in ENGLISH.
         - CRITICAL ANCHOR RULE: Every single image_prompt MUST start exactly with: "Comic book panel illustration, graphic novel art, drawing of TOK, an adult man, "
         - MULTI-CHARACTER RULE: If the story involves both characters in a scene, you MUST include both of their trigger words in the image_prompt (e.g., "drawing of TOK, an adult man, standing next to ${secondaryTrigger || ''}, a friendly dog, " or "drawing of TOK and ${secondaryTrigger || ''} sitting together").
         - CRITICAL ISOLATION RULE: NEVER include any other human characters except TOK and ${secondaryTrigger || 'none'}.
         - CRITICAL CAMERA RULE: Vary the camera angles freely (close-ups, medium shots, wide shots). Keep facial expressions simple.
         
      Return ONLY a JSON object:
      {
        "title": "Title",
        "panels": [{ "panel_number": 1, "narration": "Text...", "image_prompt": "Comic book panel illustration, graphic novel art, drawing of TOK, an adult man, standing with ${secondaryTrigger || 'his pet'}..." }]
      }`;

    const result = await model.generateContent(fullPrompt);
    
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
