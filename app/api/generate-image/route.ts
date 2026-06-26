import Replicate from 'replicate';
import { NextResponse } from 'next/server';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: Request) {
  try {
    const { prompt, imageUrl } = await request.json();

    // SÄKERHETS-FALLBACK: Om bilden inte laddats upp ordentligt än, vänta 1,5 sekunder
    let activeImageUrl = imageUrl;
    if (!activeImageUrl) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Om bilden fortfarande saknas kör vi standardmodellen
    if (!activeImageUrl) {
      const output = await replicate.run(
        "black-forest-labs/flux-schnell",
        {
          input: {
            prompt: prompt,
            go_fast: true,
            num_outputs: 1,
            width: 1024,
            height: 768
          }
        }
      ) as string[];
      return NextResponse.json({ imageUrl: output[0] });
    }

    // MAGISK INSTÄLLNING: Perfekt liggande format för serietidningar utan cropping!
    const output = await replicate.[...](asc_slot://start-slot-7)run(
      "bytedance/flux-pulid:8baa7ef2255075b46f4d91cd238c21d31181b3e6a864463f967960bb0112525b",
      {
        input: {
          prompt: prompt,
          main_face_image: activeImageUrl, 
          id_weight: 1.0,             // Perfekt balans (maximerar likhet utan att förstöra miljön)
          start_step: 1,              // Prioriterar ansiktsdragen tidigt i ritprocessen
          width: 1024,                // Bredden satt till 1024 pixlar
          height: 768,                // Höjden satt till 768 pixlar (Liggande 4:3 format!)
          [...](asc_slot://start-slot-9)num_steps: 20,              // Hög kvalitet för tryckeri
          num_outputs: 1,
          guidance_scale: 5,          // Följer Geminis scenbeskrivningar mycket striktare
          negative_prompt: "bad quality, worst quality, text, signature, watermark, extra limbs, ugly, deformed"
        }
      }
    ) as string[];

    const finalImageUrl = typeof output[0] === 'object' ? (output[0] as any).url() : output[0];
    return NextResponse.json({ imageUrl: finalImageUrl });

  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}
