import Replicate from 'replicate';
import { NextResponse } from 'next/server';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
  useFileOutput: false 
} as any);

export async function POST(request: Request) {
  try {
    const { prompt, imageInputs, aspect_ratio } = await request.json();

    console.log(`Skapar bild med hög likhet i Nano Banana 2 för: ${prompt}`);

    const input: any = {
      prompt: prompt,
      aspect_ratio: aspect_ratio || "4:3",
      resolution: "1K",
      output_format: "jpg",
      
      // HÄR ÄR NYCKELN: Vi ökar troheten (subject fidelity) till 0.9 (standard är ofta ~0.6-0.7).
      // Detta tvingar Nano Banana 2 att fästa extremt stor vikt vid era faktiska ansikten!
      subject_fidelity: 0.9,
      image_reference_weight: 0.9
    };

    // Skicka med bilderna direkt som referenser till Nano Banana 2
    if (imageInputs && Array.isArray(imageInputs) && imageInputs.length > 0) {
      input.image_input = imageInputs.slice(0, 14);
    }

    const output = await replicate.run(
      "google/nano-banana-2",
      { input }
    );

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
