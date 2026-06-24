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
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Vi förbereder innehållet till AI:n (prompterna)
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
      `Write a short, cozy, and magical children's bedtime story based on this memory or idea: "${prompt}". 
      
      IMPORTANT RULES:
      1. You must write the story in the exact same language that the prompt is written in (e.g., if the prompt is in Swedish, write the story in Swedish).
      2. If a photo of the main character is provided, analyze the child's appearance (e.g., hair color, clothing style, facial features, gender, or happy expression) and naturally incorporate these visual details when describing the character in the story.
      3. Keep it uplifting, safe for all ages, and engaging.`
    );

    const result = await model.generateContent(contents);
    const text = result.response.text();

    return new Response(JSON.stringify({ story: text }), {
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
