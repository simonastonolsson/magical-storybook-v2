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
    // Frågar Replicate hur det går med uppgiften
    const prediction = await replicate.predictions.get(trainingId);
    
    // Status kan vara "starting", "processing", "succeeded" eller "failed"
    return NextResponse.json({ 
      status: prediction.status, 
      output: prediction.output // När status är "succeeded" kommer output innehålla länkarna till din färdiga modell!
    });
  } catch (error) {
    console.error('Check training error:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}
