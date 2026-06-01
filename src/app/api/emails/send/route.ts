import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectDB from '@/lib/db/mongodb';
import EmailQueue from '@/lib/models/EmailQueue';
import { MAX_ATTACHMENT_BYTES, toObjectIds, validateEmailPayload } from '@/lib/email/validation';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import mongoose from 'mongoose';

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = await checkRateLimit(
      `send:${session.user.id || getClientIp(req)}`,
      20,
      60 * 60 * 1000
    );
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many send attempts. Please try again later.' }, { status: 429 });
    }

    const body = await req.json();
    const {
      attachment_ids,
      template_id,
      signature_id,
    } = body;
    const { toAddresses, ccAddresses, subject, body: sanitizedBody } = validateEmailPayload({
      to_addresses: body.to_addresses,
      cc_addresses: body.cc_addresses,
      subject: body.subject,
      body: body.body,
    });

    // Set reply_to to the logged-in user's email
    const replyTo = session.user.email;
    if (!replyTo) {
      return NextResponse.json({ error: 'Sender email not found in session.' }, { status: 400 });
    }

    const objectIds = toObjectIds(attachment_ids);
    if (objectIds.length > 0) {
      const db = mongoose.connection.db;
      if (!db) {
        throw new Error('MongoDB connection is not ready.');
      }

      const fileDocs = await db
        .collection('attachments.files')
        .find({ _id: { $in: objectIds } })
        .toArray();

      if (fileDocs.length !== objectIds.length) {
        return NextResponse.json({ error: 'One or more attachments were not found.' }, { status: 400 });
      }

      const totalSize = fileDocs.reduce((sum, fileDoc) => sum + (fileDoc.metadata?.size || fileDoc.length || 0), 0);
      if (totalSize > MAX_ATTACHMENT_BYTES) {
        return NextResponse.json({ error: 'Total attachment size cannot exceed 25 MB.' }, { status: 400 });
      }

      const invalidOwner = fileDocs.find((fileDoc) => fileDoc.metadata?.uploadedBy !== session.user.id);
      if (invalidOwner) {
        return NextResponse.json({ error: 'You do not have permission to use one or more attachments.' }, { status: 403 });
      }
    }

    // Insert into EmailQueue
    const newQueueItem = new EmailQueue({
      created_by: session.user.id,
      from_email: 'info@m37labs.com',
      to_addresses: toAddresses,
      cc_addresses: ccAddresses,
      subject,
      body: sanitizedBody,
      attachment_ids: objectIds,
      template_id: template_id || null,
      signature_id: signature_id || null,
      reply_to: replyTo,
      status: 'QUEUED',
    });

    await newQueueItem.save();

    console.log(`Queued email job ${newQueueItem._id} created by ${session.user.email}`);

    return NextResponse.json(
      {
        message: 'Email has been queued successfully',
        id: newQueueItem._id.toString(),
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error in POST /api/emails/send:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.message ? 400 : 500 });
  }
}
