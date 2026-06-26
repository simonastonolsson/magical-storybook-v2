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
    // VIKTIGT: Vi använder trainings.get för att få fram både modellen och versionen
    const training = await replicate.trainings.get(trainingId);
    
    // Vi pusslar ihop den perfekta sökvägen (t.ex. simon/modell:version)
    const assembledPath = (training as any).model && training.version 
      ? `${(training as any).model}:${training.version}` 
      : training.version || training.output;

    return NextResponse.json({ 
      status: training.status, 
      fullPath: assembledPath
    });
  } catch (error) {
    console.error('Check training error:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}
