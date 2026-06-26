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

    // MAGIN: Vi anropar ByteDance's Flux PuLID-modell med det stabila versions-ID:t!
    const output = await replicate.run(
      "bytedance/flux-pulid:8baa7ef2255075b46f4d91cd238c21d31181b3e6a864463f967960bb0112525b",
      {
        input: {
          prompt: prompt,
          main_face_image: imageUrl, // Skickar med barnets uppladdade bild
          start_step: 4,             // Standardinställning för hur tidigt ansiktet ska infogas
          num_outputs: 1,
          negative_prompt: "bad quality, worst quality, text, signature, watermark, extra limbs"
        }
      }
    ) as string[];

    // Denna modell returnerar ibland en lista av objekt istället för rena textsträngar.
    // Vi säkerställer att vi plockar ut rätt bild-URL:
    const finalImageUrl = typeof output[0] === 'object' ? (output[0] as any).url() : output[0];

    return NextResponse.json({ imageUrl: finalImageUrl });

  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}
