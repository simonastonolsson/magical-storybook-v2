import { GoogleGenerativeAI } from "@google/generative-ai";

// Hjälpfunktion för att ladda ner bilden och göra om den till det format som Gemini kräver
async function fetchImageAsBase64(url: string) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const mimeType = response.headers.get("content-type") || "image/jpeg";
  return {
    inlineData: {
      data: Buffer.from(buffer).toString("base64"),
      mimeType
    },
  };
}

export async function POST(req: Request) {
  try {
    const { prompt, characterImageUrl } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key is missing on server" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Vi lägger till responseMimeType för att tvinga fram JSON-format
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const contents: any[] = [];

    // Om användaren har laddat upp en bild, ladda ner den och skicka med till AI:n så den kan "se" barnet!
    if (characterImageUrl) {
      try {
        const imagePart = await fetchImageAsBase64(characterImageUrl);
        contents.push(imagePart);
      } catch (err) {
        console.error("Failed to fetch character image for Gemini:", err);
      }
    }

    // Lägg till den textbaserade instruktionen
    contents.push(
      `You are an expert comic book director and storyteller. Based on the user's idea: "${prompt}".
      
      Create a comic book script with exactly 4 to 5 panels.
      
      IMPORTANT RULES:
      1. "narration": Write the actual story text for each panel in the EXACT SAME LANGUAGE as the user's prompt (e.g., Swedish if prompted in Swedish).
      2. "image_prompt": Write a highly detailed prompt for an AI image generator IN ENGLISH. 
      3. If a photo is provided, carefully analyze the character's appearance (hair color, clothes, age, gender). Include these visual details in EVERY SINGLE "image_prompt" so the character looks consistent in every image. Add "comic book illustration style, vibrant, magical" to the end of the image prompts.
      
      Return ONLY a JSON object with this exact structure:
      {
        "title": "Title of the story",
        "panels": [
          {
            "panel_number": 1,
            "narration": "Story text here...",
            "image_prompt": "English image prompt here..."
          }
        ]
      }`
    );

    const result = await model.generateContent(contents);
    const jsonText = result.response.text();
    
    // Vi packar upp JSON-datan från AI:n
    const comicData = JSON.parse(jsonText);
    
    // Skicka tillbaka den rena datan till framsidan!
    return new Response(JSON.stringify({ comic: comicData }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error generating story:", error);
    return new Response(JSON.stringify({ error: "Failed to generate story" }), { 
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
