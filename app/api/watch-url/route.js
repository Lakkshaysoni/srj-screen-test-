import { NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2 } from '../../../lib/r2';

export async function POST(request) {
  const { storageKey } = await request.json();

  if (!storageKey) {
    return NextResponse.json({ error: 'storageKey required' }, { status: 400 });
  }

  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: storageKey,
  });

  // 4 hour expiry — long enough for a screening session, not a permanent public link
  const playbackUrl = await getSignedUrl(r2, command, { expiresIn: 14400 });

  return NextResponse.json({ playbackUrl });
}
