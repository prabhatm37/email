import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectDB from '@/lib/db/mongodb';
import Template from '@/lib/models/Template';
import { sanitizeRichText, validateOptionalEmailList } from '@/lib/email/validation';

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    let query = {};
    if (session.user.role !== 'SENIOR_PRODUCT_MANAGER') {
      // Product Managers only see their own templates
      query = { created_by: session.user.id };
    }

    const templates = await Template.find(query)
      .populate('created_by', 'full_name email')
      .sort({ createdAt: -1 });

    return NextResponse.json(templates);
  } catch (error: any) {
    console.error('Error in GET /api/templates:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
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

    const newTemplate = new Template({
      name: name.trim(),
      to_addresses: toAddresses,
      cc_addresses: ccAddresses,
      subject: subject.trim(),
      body: sanitizeRichText(templateBody),
      status: 'ACTIVE',
      visibility: 'PERSONAL',
      created_by: session.user.id,
    });

    await newTemplate.save();
    
    // Populate before returning
    const populated = await newTemplate.populate('created_by', 'full_name email');

    return NextResponse.json(populated, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/templates:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.message ? 400 : 500 });
  }
}
