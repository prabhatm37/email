import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { auth } from '@/auth';
import connectDB from '@/lib/db/mongodb';
import { deleteAttachmentFile, getAttachmentForEmail } from '@/lib/attachments/storage';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await ctx.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const objectId = new mongoose.Types.ObjectId(id);

    await connectDB();
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('MongoDB connection is not ready.');
    }

    // Find the file document in the attachments.files metadata collection
    const fileDoc = await db.collection('attachments.files').findOne({ _id: objectId });

    if (!fileDoc) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    if (
      session.user.role !== 'SENIOR_PRODUCT_MANAGER' &&
      fileDoc.metadata?.uploadedBy !== session.user.id
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const bucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: 'attachments',
    });

    if (fileDoc.metadata?.storage === 'supabase') {
      const attachment = await getAttachmentForEmail(fileDoc as any, bucket);

      return new Response(new Uint8Array(attachment.content), {
        headers: {
          'Content-Type': attachment.contentType,
          'Content-Disposition': `attachment; filename="${encodeURIComponent(attachment.filename)}"`,
          'Content-Length': String(attachment.content.length),
        },
      });
    }

    const downloadStream = bucket.openDownloadStream(objectId);

    // Convert Node Readable stream to Web ReadableStream for Next.js response
    const webStream = new ReadableStream({
      start(controller) {
        downloadStream.on('data', (chunk) => controller.enqueue(chunk));
        downloadStream.on('end', () => controller.close());
        downloadStream.on('error', (err) => controller.error(err));
      },
      cancel() {
        downloadStream.destroy();
      }
    });

    return new Response(webStream, {
      headers: {
        'Content-Type': fileDoc.metadata?.contentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileDoc.filename)}"`,
        'Content-Length': fileDoc.length.toString(),
      },
    });
  } catch (error: any) {
    console.error(`Error downloading attachment [id]:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await ctx.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const objectId = new mongoose.Types.ObjectId(id);

    await connectDB();
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('MongoDB connection is not ready.');
    }

    // Fetch the file to check uploader permissions
    const fileDoc = await db.collection('attachments.files').findOne({ _id: objectId });

    if (!fileDoc) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    // PM can only delete their own attachments; SPM can delete any
    if (
      session.user.role !== 'SENIOR_PRODUCT_MANAGER' &&
      fileDoc.metadata?.uploadedBy !== session.user.id
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const bucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: 'attachments',
    });

    await deleteAttachmentFile(fileDoc as any, bucket);
    console.log(`Deleted attachment ${id}`);

    return NextResponse.json({ message: 'Attachment deleted successfully' });
  } catch (error: any) {
    console.error(`Error deleting attachment [id]:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
