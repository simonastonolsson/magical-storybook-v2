import Replicate from 'replicate';
import { NextResponse } from 'next/server';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const trainingId = searchParams.get('id');

  if (!trainingId) {
    return NextResponse.json({ error: 'Missing training ID' }, { status: 400 });
  }

  try {
    const prediction = await replicate.predictions.get(trainingId);
    
    // Vi lägger till "version" här så att framsidan kan spara den direkt!
    return NextResponse.json({ 
      status: prediction.status, 
      output: prediction.output,
      version: prediction.version
    });
  } catch (error) {
    console.error('Check training error:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}
