import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const { originalPrompt, instruction } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: "API key missing" }), { status: 500 });

    const genAI = new GoogleGenerativeAI(apiKey);
    
    const prompt = `You are an assistant that modifies image prompts.
      Original prompt: "${originalPrompt}"
      Modification instruction: "${instruction}"
      
      Apply the user's instruction to the original prompt. 
      CRITICAL: Keep the exact same style, structure, the trigger word "TOK", the identified gender, and the "Comic book panel illustration, graphic novel art..." format. ONLY change the specific details requested in the instruction (e.g. changing jacket color, adding an item).
      Return ONLY the modified prompt string in English. Do not include any JSON, markdown, or extra explanations.`;

    let result;
    try {
      // Försök först med gemini-2.5-flash
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 
      result = await model.generateContent(prompt);
    } catch (primaryError) {
      console.warn("gemini-2.5-flash överbelastad under om-promptning, faller tillbaka på gemini-1.5-flash...");
      
      // Fallback till den extremt driftsäkra gemini-1.5-flash
      const fallbackModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      result = await fallbackModel.generateContent(prompt);
    }
    
    const newPrompt = result.response.text().trim();

    return new Response(JSON.stringify({ refinedPrompt: newPrompt }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Refine prompt error:", error);
    return new Response(JSON.stringify({ error: "Failed to refine prompt" }), { status: 500 });
  }
}
