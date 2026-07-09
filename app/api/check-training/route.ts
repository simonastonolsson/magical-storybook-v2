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

      // destination + output.version (owner/model:version) is the only valid
      // model reference for replicate.run() in generate-image/route.ts.
      // weightsUrl is a raw .tar weights file - never a valid model reference.
      // Previously this silently fell back to weightsUrl when destination/
      // version were missing, which saved an unusable model_path with no
      // error until image generation failed much later. Fail loudly instead.
      if (!training.destination || !training.output?.version) {
        console.error(
          'Training succeeded but destination/output.version missing from Replicate response. Full training.output:',
          JSON.stringify(training.output)
        );
        return NextResponse.json({
          status: 'failed',
          error: 'Training succeeded but destination/version missing from Replicate response',
        }, { status: 500 });
      }

      const fullPath = `${training.destination}:${training.output.version}`;

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
