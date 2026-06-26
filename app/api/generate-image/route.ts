import Replicate from 'replicate';
import { NextResponse } from 'next/server';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: Request) {
  try {
    const { prompt, imageUrl } = await request.json();

    // SÄKERHETS-FALLBACK:
    let activeImageUrl = imageUrl;
    if (!activeImageUrl) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

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

    // LEVANDE SCENER: Vi sänker styrkan något och höjer start_step så att kroppen och posen ritas först!
    const output = await replicate.run(
      "bytedance/flux-pulid:8baa7ef2255075b46f4d91cd238c21d31181b3e6a864463f967960bb0112525b",
      {
        input: {
          prompt: prompt,
          main_face_image: activeImageUrl, 
          id_weight: 0.82,            // Sänkt från 1.0 till 0.82 för naturligare vinklar och poser
          start_step: 4,              // Höjt till 4! Låter AI:n rita kroppen och rörelsen först
          width: 1024,                
          height: 768,                
          num_steps: 20,              
          num_outputs: 1,
          guidance_scale: 5.5,        // Följer prompten ännu striktare för att få med detaljer som midsommarstänger
          negative_prompt: "looking directly at camera, mugshot, staring, static pose, bad quality, watermark, text"
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
