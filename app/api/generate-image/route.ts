import Replicate from 'replicate';
import { NextResponse } from 'next/server';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: Request) {
  try {
    const { prompt, imageUrl } = await request.json();

    // FALLBACK: Om bildlänken av någon anledning är tom, kör vi standardmodellen.
    if (!imageUrl) {
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
    const output = await replicate.run(
      "bytedance/flux-pulid:8baa7ef2255075b46f4d91cd238c21d31181b3e6a864463f967960bb0112525b",
      {
        input: {
          prompt: prompt,
          main_face_image: imageUrl,
          id_weight: 1.0,
          start_step: 1,
          width: 1024,
          height: 768,
          num_steps: 20,
          num_outputs: 1,
          guidance_scale: 5,
          negative_prompt: "bad quality, worst quality, text, signature, watermark, extra limbs, ugly, deformed"
        }
      }
    ) as string[];

    const finalImageUrl = typeof output[0] === 'object' ? (output[0] as any).url : output[0];
    return NextResponse.json({ imageUrl: finalImageUrl });

  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}
