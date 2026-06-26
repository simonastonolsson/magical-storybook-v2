import { GoogleGenerativeAI } from "@google/generative-ai";

async function fetchImageAsBase64(url: string) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const mimeType = response.headers.get("content-type") || "image/jpeg";
  return {
    inlineData: { data: Buffer.from(buffer).toString("base64"), mimeType },
  };
}

export async function POST(req: Request) {
  try {
    const { prompt, characterImageUrl } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: "API key missing" }), { status: 500 });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const contents: any[] = [];
    if (characterImageUrl) {
      try {
        const imagePart = await fetchImageAsBase64(characterImageUrl);
        contents.push(imagePart);
      } catch (err) {
        console.error("Failed to fetch character image for Gemini:", err);
      }
    }

    // NYA REGLER FÖR GEMINI: Tvinga fram olika kameravinklar och händelser!
    contents.push(
      `You are an expert comic book director. Based on the user's idea: "${prompt}".
      Create a comic script with exactly 4 to 5 panels.
      
      IMPORTANT RULES:
      1. "narration": Write story text in the EXACT SAME LANGUAGE as the user's prompt.
      2. "image_prompt": Write in ENGLISH. CRITICAL: You MUST vary the camera angles! Use "wide shot", "full body shot", or "action shot". Do NOT just make close-up portraits. Describe the environment (e.g., a midsummer pole, nature) and what the character is doing (e.g., dancing, running).
      3. If a photo is provided, analyze the character's appearance (hair, clothes, gender) and include it in every prompt. End all prompts with: "comic book illustration style, vibrant, highly detailed background".
      
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
