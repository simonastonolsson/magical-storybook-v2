import Replicate from 'replicate';
import { NextResponse } from 'next/server';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
  useFileOutput: false // Tvingar Replicate att returnera snabba bildlänkar istället för filer
} as any); // as any förbigår typkontrollen vid bygget så att det kompilerar felfritt!

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

    // Skicka med bilderna direkt som referenser till Nano Banana 2 (upp till 14 bilder!)
    if (imageInputs && Array.isArray(imageInputs) && imageInputs.length > 0) {
      input.image_input = imageInputs.slice(0, 14);
    }

    const output = await replicate.run(
      "google/nano-banana-2",
      { input }
    );

    // DYNAMISK OCH SKOTTSÄKER BILD-TOLKARE (Parser)
    let finalImageUrl = "";
    if (typeof output === 'string') {
      finalImageUrl = output;
    } else if (Array.isArray(output) && output.length > 0) {
      const first = output[0];
      finalImageUrl = typeof first === 'string' ? first : (first?.url || first?.toString() || "");
    } else if (output && typeof output === 'object') {
      finalImageUrl = (output as any).url || output.toString() || "";
    }

    console.log(`Hittade bildlänk: ${finalImageUrl}`);

    if (!finalImageUrl || finalImageUrl.includes('[object')) {
      return NextResponse.json({ error: 'Image generation failed' }, { status: 500 });
    }

    return NextResponse.json({ imageUrl: finalImageUrl });

  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}
