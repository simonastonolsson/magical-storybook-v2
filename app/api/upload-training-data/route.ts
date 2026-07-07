import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const BUCKET = 'training-data';
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60; // 1 hour

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const path = `${user.id}/training-${Date.now()}.zip`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: 'application/zip', upsert: false });

    if (uploadError) {
      throw uploadError;
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);

    if (signedUrlError || !signedUrlData) {
      throw signedUrlError ?? new Error('Failed to create signed URL');
    }

    return NextResponse.json({ url: signedUrlData.signedUrl });
  } catch (error) {
    console.error('Training data upload error:', error);
    return NextResponse.json({ error: 'Failed to upload training data' }, { status: 500 });
  }
}
