import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');

    if (!filename) {
      return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
    }

    const body = request.body;
    if (!body) {
      return NextResponse.json({ error: 'No file body found' }, { status: 400 });
    }

    // Detta laddar upp bilden till ditt nyskapade Vercel Blob-lager
    const blob = await put(filename, body, {
      access: 'private',
    });

    return NextResponse.json(blob);
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }
}
