import { NextResponse } from 'next/server';
import Replicate from 'replicate';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing training ID' }, { status: 400 });
  }

  try {
    const training = (await replicate.trainings.get(id)) as any;
    console.log("Training status:", training.status);

    if (training.status === 'succeeded') {
      const weightsUrl = training.output?.weights || null;
      
      let fullPath = null;
      // FIXEN: Vi sparar i det officiella formatet med kolon (owner/model:version)
      if (training.destination && training.output?.version) {
        fullPath = `${training.destination}:${training.output.version}`;
      } else {
        fullPath = weightsUrl;
      }

      return NextResponse.json({ 
        status: 'succeeded', 
        fullPath: fullPath,
        weights: weightsUrl
      });
    }

    return NextResponse.json({ status: training.status });
  } catch (error) {
    console.error('Check training error:', error);
    return NextResponse.json({ error: 'Failed to check training status' }, { status: 500 });
  }
}
