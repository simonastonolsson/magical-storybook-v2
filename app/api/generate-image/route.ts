import Replicate from 'replicate';
import { NextResponse } from 'next/server';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
} as any);

export async function POST(request: Request) {
  try {
    const { 
      prompt, 
      trainedModelId, 
      triggerWord,
      charDesc,
      charName,
      extraLoraId, 
      extraLoraScale 
    } = await request.json();

    if (!trainedModelId) {
      return NextResponse.json({ error: 'Missing trainedModelId' }, { status: 400 });
    }

    const isChild = charDesc?.toLowerCase().includes("boy") || 
                    charDesc?.toLowerCase().includes("girl") ||
                    charDesc?.toLowerCase().includes("child") ||
                    charDesc?.toLowerCase().includes("baby");

    const signatureOutfit = isChild
      ? "wearing a cozy yellow raincoat and blue denim jeans"
      : "wearing a classic navy blue sweater and dark grey trousers";

    const characterAnchor = `${triggerWord || 'TOK'}, ${charDesc || 'a person'}, ${signatureOutfit}`;

    let cleanedPrompt = prompt || "";

    // Ta bort style-prefix om Gemini redan lagt till det
    const stylePrefixes = [
      "Comic book panel illustration, graphic novel art,",
      "Comic book panel illustration, graphic novel art"
    ];
    for (const prefix of stylePrefixes) {
      if (cleanedPrompt.toLowerCase().startsWith(prefix.toLowerCase())) {
        cleanedPrompt =
