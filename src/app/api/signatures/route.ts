import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectDB from '@/lib/db/mongodb';
import Signature from '@/lib/models/Signature';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const scope = req.nextUrl.searchParams.get('scope');
    let query = {};

    if (scope === 'mine') {
      query = { created_by: session.user.id };
    } else if (session.user.role !== 'SENIOR_PRODUCT_MANAGER') {
      // Product Managers only see their own signatures
      query = { created_by: session.user.id };
    }

    const signatures = await Signature.find(query)
      .populate('created_by', 'full_name email')
      .sort({ createdAt: -1 });

    return NextResponse.json(signatures);
  } catch (error: any) {
    console.error('Error in GET /api/signatures:', error);
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
    const { name, body: signatureBody, is_default } = body;

    if (!name || !signatureBody) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // If setting as default, clear other default signatures for this user
    if (is_default) {
      await Signature.updateMany(
        { created_by: session.user.id },
        { is_default: false }
      );
    }

    // If it's the user's first signature, force it to be default
    const count = await Signature.countDocuments({ created_by: session.user.id });
    const shouldBeDefault = count === 0 ? true : !!is_default;

    const newSignature = new Signature({
      name,
      body: signatureBody,
      visibility: 'PERSONAL',
      is_default: shouldBeDefault,
      status: 'ACTIVE',
      created_by: session.user.id,
    });

    await newSignature.save();
    
    // Populate before returning
    const populated = await newSignature.populate('created_by', 'full_name email');

    return NextResponse.json(populated, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/signatures:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
