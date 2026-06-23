import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key is missing on server" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent(
      `Write a short, cozy, and magical children's bedtime story in English based on this memory or idea: "${prompt}". Keep it uplifting, safe for all ages, and engaging.`
    );

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
