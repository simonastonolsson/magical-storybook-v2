import Replicate from 'replicate';
import { NextResponse } from 'next/server';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: Request) {
  try {
    const { prompt, trainedModelId } = await request.json();

    if (!trainedModelId) {
      return NextResponse.json({ error: 'Trained model ID is missing!' }, { status: 400 });
    }

    // IDIOTSÄKERHET: Vi säkerställer att triggerordet "TOK" ALLTID finns med i början av prompten!
    let finalPrompt = prompt;
    if (!finalPrompt.includes("TOK")) {
        finalPrompt = `TOK person, ${prompt}`;
    }
    // Rensa upp ifall Gemini skrivit in förvirrande text som "a photo of TOK"
    finalPrompt = finalPrompt.replace(/a photo of TOK/gi, "TOK person");

    console.log(`Skapar bild med prompt: ${finalPrompt}`);

    const output = await replicate.run(
      trainedModelId as `${string}/${string}:${string}`, 
      {
        input: {
          prompt: finalPrompt,
          width: 1024,
          height: 768,
          num_inference_steps: 28, 
          guidance_scale: 3.5,     
          lora_scale: 1.25 // Skruvat upp från 1.15 för att TVINGA fram maximal ansiktslikhet!
        }
      }
    );

    const finalImageUrl = Array.isArray(output) && output.length > 0 ? output[0] : null;

    if (!finalImageUrl) {
        return NextResponse.json({ error: 'Image generation failed to produce an output.' }, { status: 500 });
    }

    return NextResponse.json({ imageUrl: finalImageUrl });

  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}
