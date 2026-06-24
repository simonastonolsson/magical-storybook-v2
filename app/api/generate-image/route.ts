import Replicate from 'replicate';
import { NextResponse } from 'next/server';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: Request) {
  try {
    const { prompt, imageUrl } = await request.json();

    // Vi använder en supersnabb standardmodell (Flux) först för att testa att hela kedjan fungerar.
    // I nästa steg byter vi ut denna mot en specifik "Face Consistency"-modell som använder din uppladdade bild!
    const output = await replicate.run(
      "black-forest-labs/flux-schnell",
      {
        input: {
          prompt: prompt,
          go_fast: true,
          num_outputs: 1
        }
      }
    );

    // Replicate returnerar en array med länkar, vi skickar tillbaka den första (själva bilden)
    return NextResponse.json({ imageUrl: output[0] });
  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}
