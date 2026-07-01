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
    // FIXEN: Vi tvingar TypeScript att tolka svaret som "any" för att slippa rigid typkontroll vid bygget
    const training = (await replicate.trainings.get(id)) as any;
    console.log("Training status:", training.status);

    if (training.status === 'succeeded') {
      // HÄR ÄR FIXEN: Vi hämtar den direkta .tar-länken till vikterna från Replicate CDN!
      const weightsUrl = training.output?.weights || null;
      
      let fullPath = weightsUrl;
      // Fallback till formaterad modell-ID om weights saknas
      if (!fullPath && training.destination && training.output?.version) {
        fullPath = `${training.destination}/${training.output.version}`;
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
