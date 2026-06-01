import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectDB from '@/lib/db/mongodb';
import Template from '@/lib/models/Template';
import { sanitizeRichText, validateOptionalEmailList } from '@/lib/email/validation';

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

    await connectDB();
    const template = await Template.findById(id).populate('created_by', 'full_name email');

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Role scope verification
    if (
      session.user.role !== 'SENIOR_PRODUCT_MANAGER' &&
      template.created_by._id.toString() !== session.user.id
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(template);
  } catch (error: any) {
    console.error(`Error in GET /api/templates/[id]:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await ctx.params;
    const body = await req.json();
    const { name, subject, body: templateBody } = body;
    const toAddresses = validateOptionalEmailList(body.to_addresses, 'TO');
    const ccAddresses = validateOptionalEmailList(body.cc_addresses, 'CC');

    if (!name || !subject || !templateBody) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const overlap = ccAddresses.find((email) => toAddresses.includes(email));
    if (overlap) {
      return NextResponse.json({ error: `The same email address cannot be added in both TO and CC: ${overlap}` }, { status: 400 });
    }

    await connectDB();
    const template = await Template.findById(id);

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Role scope verification
    if (
      session.user.role !== 'SENIOR_PRODUCT_MANAGER' &&
      template.created_by.toString() !== session.user.id
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    template.name = name.trim();
    template.to_addresses = toAddresses;
    template.cc_addresses = ccAddresses;
    template.subject = subject.trim();
    template.body = sanitizeRichText(templateBody);
    await template.save();

    const populated = await template.populate('created_by', 'full_name email');
    return NextResponse.json(populated);
  } catch (error: any) {
    console.error(`Error in PUT /api/templates/[id]:`, error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.message ? 400 : 500 });
  }
}
