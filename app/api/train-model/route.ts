import Replicate from 'replicate';
import { NextResponse } from 'next/server';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: Request) {
  try {
    const { zipUrl } = await request.json();

    if (!zipUrl) {
      return NextResponse.json({ error: 'Missing zip URL' }, { status: 400 });
    }

    // Startar träningsjobbet i bakgrunden med branschstandard-tränaren ostris/flux-dev-lora-trainer
    const prediction = await replicate.predictions.create({
      version: "b6b801a613271fcdbb3111fdbbcfa4c90e0b5dd1341a9d4ea8638fb01c0cf9ef", 
      input: {
        input_images: zipUrl,
        trigger_word: "TOK", // Det magiska ordet vi använder i våra prompter sedan!
        steps: 1000,
        resolution: "512,768,1024",
      }
    });

    // Vi returnerar ID:t för träningen så framsidan kan fråga "är den klar än?"
    return NextResponse.json({ trainingId: prediction.id });
  } catch (error) {
    console.error('Training start error:', error);
    return NextResponse.json({ error: 'Failed to start training' }, { status: 500 });
  }
}
