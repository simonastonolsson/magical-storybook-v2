import Replicate from 'replicate';
import { NextResponse } from 'next/server';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: Request) {
  try {
    const { prompt, imageUrl } = await request.json();

    // Om användaren inte har laddat upp en bild kör vi en vanlig snabb generering som fallback
    if (!imageUrl) {
      const output = await replicate.run(
        "black-forest-labs/flux-schnell",
        {
          input: {
            prompt: prompt,
            go_fast: true,
            num_outputs: 1
          }
        }
      ) as string[];
      return NextResponse.json({ imageUrl: output[0] });
    }

    // MAGIN: Vi anropar ByteDance's Flux PuLID-modell som klonar ansiktet!
    const output = await replicate.run(
      "bytedance/flux-pulid:8194ba1e3d92c00db8f11deee0cc7e21cbc948ea96efaf160cb7d4f738b556b6",
      {
        input: {
          prompt: prompt,
          main_face_image: imageUrl, // Skickar med barnets uppladdade bild
          id_weight: 0.85,           // Hur starkt ansiktet ska efterliknas (0.8 - 0.9 är perfekt)
          num_steps: 20,             // Kvalitetssteg (20-25 ger tryckeri-kvalitet)
          guidance_scale: 4,
          width: 896,                // Hög upplösning anpassad för serietidningsformat
          height: 1152,              // Stående format, perfekt för tryckeri
        }
      }
    ) as string[];

    return NextResponse.json({ imageUrl: output[0] });

  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}
