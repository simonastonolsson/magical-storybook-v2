import Replicate from 'replicate';
import { NextResponse } from 'next/server';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: Request) {
  try {
    const { prompt, imageUrl } = await request.json();

    const output = await replicate.run(
      "black-forest-labs/flux-schnell",
      {
        input: {
          prompt: prompt,
          go_fast: true,
          num_outputs: 1
        }
      }
    // TYPKORRIGERING: Vi talar om för TypeScript att vi förväntar oss en lista med strängar.
    ) as string[];

    // Replicate returnerar en array med länkar, vi skickar tillbaka den första (själva bilden)
    return NextResponse.json({ imageUrl: output[0] });

  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}
