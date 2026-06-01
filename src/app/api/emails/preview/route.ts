import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { validateEmailPayload } from '@/lib/email/validation';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { toAddresses, ccAddresses, subject, body: sanitizedBody } = validateEmailPayload({
      to_addresses: body.to_addresses,
      cc_addresses: body.cc_addresses,
      subject: body.subject,
      body: body.body,
    });

    // Return the preview structure
    return NextResponse.json({
      to_addresses: toAddresses,
      cc_addresses: ccAddresses,
      subject,
      body: sanitizedBody,
      from: 'info@m37labs.com',
      reply_to: session.user.email,
    });
  } catch (error: any) {
    console.error('Error in POST /api/emails/preview:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.message ? 400 : 500 });
  }
}
