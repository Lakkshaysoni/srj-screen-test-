import { NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2 } from '../../../lib/r2';

export async function POST(request) {
  const { filename, contentType } = await request.json();

  if (!filename) {
    return NextResponse.json({ error: 'filename required' }, { status: 400 });
  }

  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storageKey = `${Date.now()}-${safeName}`;

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: storageKey,
    ContentType: contentType || 'video/mp4',
  });

  const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 3600 });

  return NextResponse.json({ uploadUrl, storageKey });
}
