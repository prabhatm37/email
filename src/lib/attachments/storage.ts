import { createClient } from '@supabase/supabase-js';
import mongoose from 'mongoose';
import type { GmailAttachment } from '@/lib/gmail/send';

export interface StorageUploadRequest {
  filename: string;
  size: number;
  contentType: string;
  uploadedBy: string;
}

export interface StorageAttachmentPayload extends StorageUploadRequest {
  attachmentId: string;
  path: string;
}

interface AttachmentFileDoc {
  _id: mongoose.Types.ObjectId;
  filename: string;
  length?: number;
  metadata?: {
    storage?: 'supabase' | 'gridfs';
    supabasePath?: string;
    contentType?: string;
    size?: number;
    uploadedBy?: string;
  };
}

function getSupabaseEnv() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET;

  if (!url || !serviceRoleKey || !bucket) {
    throw new Error('Supabase Storage is not configured.');
  }

  return { url, serviceRoleKey, bucket };
}

function getSupabasePublicKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

export function isSupabaseStorageConfigured() {
  return Boolean(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.SUPABASE_STORAGE_BUCKET &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    getSupabasePublicKey()
  );
}

function getSupabaseAdmin() {
  const env = getSupabaseEnv();
  return createClient(env.url, env.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function normalizeAttachmentInput(input: Partial<StorageUploadRequest>): StorageUploadRequest {
  const filename = String(input.filename || '').trim();
  const size = Number(input.size || 0);
  const contentType = String(input.contentType || 'application/octet-stream');
  const uploadedBy = String(input.uploadedBy || '');

  if (!filename) {
    throw new Error('Attachment filename is required.');
  }
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error('Attachment size is invalid.');
  }
  if (!uploadedBy) {
    throw new Error('Attachment owner is required.');
  }

  return { filename, size, contentType, uploadedBy };
}

export function normalizeStorageAttachmentPayload(
  input: Partial<StorageAttachmentPayload>
): StorageAttachmentPayload {
  const payload = normalizeAttachmentInput(input);
  const attachmentId = String(input.attachmentId || '');
  const path = String(input.path || '');

  if (!mongoose.Types.ObjectId.isValid(attachmentId)) {
    throw new Error('Invalid attachment ID.');
  }
  if (!path) {
    throw new Error('Attachment storage path is required.');
  }

  return { ...payload, attachmentId, path };
}

export function createAttachmentId() {
  return new mongoose.Types.ObjectId().toString();
}

export function sanitizeStoragePathSegment(value: string) {
  return (
    value
      .replace(/\\/g, '-')
      .replace(/\//g, '-')
      .replace(/[^\w.\- ]+/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 160) || 'attachment'
  );
}

export async function createSupabaseUpload(payload: StorageUploadRequest) {
  const env = getSupabaseEnv();
  const attachmentId = createAttachmentId();
  const path = `attachments/${payload.uploadedBy}/${attachmentId}/${sanitizeStoragePathSegment(payload.filename)}`;
  const { data, error } = await getSupabaseAdmin()
    .storage
    .from(env.bucket)
    .createSignedUploadUrl(path, { upsert: false });

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create signed upload URL.');
  }

  return {
    attachmentId,
    path,
    token: data.token,
    signedUrl: data.signedUrl,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || env.url,
    supabaseAnonKey: getSupabasePublicKey(),
    bucket: env.bucket,
  };
}

export async function registerSupabaseAttachment(
  payload: StorageAttachmentPayload,
  maxSizeBytes: number
) {
  const env = getSupabaseEnv();
  const supabase = getSupabaseAdmin();
  const { data: blob, error: downloadError } = await supabase
    .storage
    .from(env.bucket)
    .download(payload.path);

  if (downloadError || !blob) {
    throw new Error(downloadError?.message || 'Uploaded attachment was not found.');
  }

  if (blob.size <= 0) {
    throw new Error('Uploaded attachment is empty.');
  }
  if (blob.size > maxSizeBytes) {
    await supabase.storage.from(env.bucket).remove([payload.path]);
    throw new Error('File size exceeds the 25MB limit.');
  }

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('MongoDB connection is not ready.');
  }

  await db.collection('attachments.files').updateOne(
    { _id: new mongoose.Types.ObjectId(payload.attachmentId) },
    {
      $set: {
        filename: payload.filename,
        length: blob.size,
        chunkSize: 0,
        uploadDate: new Date(),
        metadata: {
          storage: 'supabase',
          supabasePath: payload.path,
          contentType: blob.type || payload.contentType || 'application/octet-stream',
          size: blob.size,
          uploadedBy: payload.uploadedBy,
        },
      },
    },
    { upsert: true }
  );
}

export async function getAttachmentForEmail(
  fileDoc: AttachmentFileDoc,
  bucket: mongoose.mongo.GridFSBucket
): Promise<GmailAttachment> {
  const filename = fileDoc.filename;
  const contentType = fileDoc.metadata?.contentType || 'application/octet-stream';

  if (fileDoc.metadata?.storage === 'supabase') {
    const env = getSupabaseEnv();
    const path = fileDoc.metadata.supabasePath;
    if (!path) {
      throw new Error(`Supabase attachment ${fileDoc._id} is missing its storage path.`);
    }

    const { data, error } = await getSupabaseAdmin()
      .storage
      .from(env.bucket)
      .download(path);

    if (error || !data) {
      throw new Error(error?.message || `Supabase attachment ${fileDoc._id} could not be downloaded.`);
    }

    return {
      filename,
      content: Buffer.from(await data.arrayBuffer()),
      contentType,
    };
  }

  const downloadStream = bucket.openDownloadStream(fileDoc._id);
  const chunks: Buffer[] = [];

  for await (const chunk of downloadStream) {
    chunks.push(chunk as Buffer);
  }

  return {
    filename,
    content: Buffer.concat(chunks),
    contentType,
  };
}

export async function deleteAttachmentFile(
  fileDoc: AttachmentFileDoc,
  bucket: mongoose.mongo.GridFSBucket
) {
  if (fileDoc.metadata?.storage === 'supabase') {
    const path = fileDoc.metadata.supabasePath;
    if (path) {
      const env = getSupabaseEnv();
      await getSupabaseAdmin().storage.from(env.bucket).remove([path]);
    }

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('MongoDB connection is not ready.');
    }
    await db.collection('attachments.files').deleteOne({ _id: fileDoc._id });
    return;
  }

  await bucket.delete(fileDoc._id);
}
