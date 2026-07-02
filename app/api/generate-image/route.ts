import Replicate from 'replicate';
import { NextResponse } from 'next/server';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: Request) {
  try {
    const { prompt, imageInputs, aspect_ratio } = await request.json();

    console.log(`Skapar bild med Nano Banana 2 för prompt: ${prompt}`);

    const input: any = {
      prompt: prompt,
      aspect_ratio: aspect_ratio || "4:3",
      resolution: "1K",
      output_format: "jpg"
    };

    // Skicka med bilderna direkt som referenser till Nano Banana 2 (stödjer upp till 14 bilder!)
    if (imageInputs && Array.isArray(imageInputs) && imageInputs.length > 0) {
      input.image_input = imageInputs.slice(0, 14);
    }

    const output = await replicate.run(
      "google/nano-banana-2",
      { input }
    );

    const finalImageUrl = Array.isArray(output) && output.length > 0 ? output[0] : null;

    if (!finalImageUrl) {
      return NextResponse.json({ error: 'Image generation failed' }, { status: 500 });
    }

    return NextResponse.json({ imageUrl: finalImageUrl });

  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}
