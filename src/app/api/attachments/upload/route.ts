import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { auth } from '@/auth';
import connectDB from '@/lib/db/mongodb';
import {
  createSupabaseUpload,
  isSupabaseStorageConfigured,
  normalizeAttachmentInput,
  normalizeStorageAttachmentPayload,
  registerSupabaseAttachment,
} from '@/lib/attachments/storage';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export async function GET() {
  return NextResponse.json({ supabaseStorageEnabled: isSupabaseStorageConfigured() });
}

async function handleGridFsUpload(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const attachmentId = formData.get('attachmentId') as string | null;
  const uploadedBy = formData.get('uploadedBy') as string | null;

  if (!file || !attachmentId || !uploadedBy) {
    return NextResponse.json({ error: 'Missing required upload data.' }, { status: 400 });
  }
  if (!mongoose.Types.ObjectId.isValid(attachmentId)) {
    return NextResponse.json({ error: 'Invalid attachment ID.' }, { status: 400 });
  }
  if (uploadedBy !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File size exceeds the 25MB limit.' }, { status: 400 });
  }

  await connectDB();
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('MongoDB connection is not ready.');
  }

  const bucket = new mongoose.mongo.GridFSBucket(db, {
    bucketName: 'attachments',
  });

  const buffer = Buffer.from(await file.arrayBuffer());
  const objectId = new mongoose.Types.ObjectId(attachmentId);
  const uploadStream = bucket.openUploadStreamWithId(objectId, file.name, {
    metadata: {
      storage: 'gridfs',
      uploadedBy: session.user.id,
      size: file.size,
      contentType: file.type || 'application/octet-stream',
    },
  });

  await new Promise<void>((resolve, reject) => {
    uploadStream.on('error', (err) => reject(err));
    uploadStream.on('finish', () => resolve());
    uploadStream.end(buffer);
  });

  return NextResponse.json({
    id: attachmentId,
    name: file.name,
    size: file.size,
    contentType: file.type || 'application/octet-stream',
  });
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      return await handleGridFsUpload(req);
    }

    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    if (body?.type === 'supabase.create-upload') {
      if (!isSupabaseStorageConfigured()) {
        return NextResponse.json({ error: 'Supabase Storage is not configured.' }, { status: 503 });
      }

      const payload = normalizeAttachmentInput({
        filename: body.filename,
        size: body.size,
        contentType: body.contentType,
        uploadedBy: session.user.id,
      });

      if (payload.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'File size exceeds the 25MB limit.' }, { status: 400 });
      }

      const upload = await createSupabaseUpload(payload);
      return NextResponse.json(upload);
    }

    if (body?.type === 'supabase.register-completed') {
      if (!isSupabaseStorageConfigured()) {
        return NextResponse.json({ error: 'Supabase Storage is not configured.' }, { status: 503 });
      }

      const payload = normalizeStorageAttachmentPayload({
        attachmentId: body.attachmentId,
        path: body.path,
        filename: body.filename,
        size: body.size,
        contentType: body.contentType,
        uploadedBy: session.user.id,
      });

      if (!payload.path.startsWith(`attachments/${session.user.id}/`)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (payload.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'File size exceeds the 25MB limit.' }, { status: 400 });
      }

      await connectDB();
      await registerSupabaseAttachment(payload, MAX_FILE_SIZE);

      return NextResponse.json({
        id: payload.attachmentId,
        name: payload.filename,
        size: payload.size,
        contentType: payload.contentType,
      });
    }

    return NextResponse.json({ error: 'Unsupported upload action.' }, { status: 400 });
  } catch (error: any) {
    console.error('Error uploading attachment:', error);
    const message = error.message || 'Internal Server Error';
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
