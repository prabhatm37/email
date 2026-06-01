import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectDB from '@/lib/db/mongodb';
import Signature from '@/lib/models/Signature';

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
    const signature = await Signature.findById(id).populate('created_by', 'full_name email');

    if (!signature) {
      return NextResponse.json({ error: 'Signature not found' }, { status: 404 });
    }

    // Role scope verification
    if (
      session.user.role !== 'SENIOR_PRODUCT_MANAGER' &&
      signature.created_by._id.toString() !== session.user.id
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(signature);
  } catch (error: any) {
    console.error(`Error in GET /api/signatures/[id]:`, error);
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
    const { name, body: signatureBody } = body;

    if (!name || !signatureBody) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await connectDB();
    const signature = await Signature.findById(id);

    if (!signature) {
      return NextResponse.json({ error: 'Signature not found' }, { status: 404 });
    }

    // Role scope verification
    if (
      session.user.role !== 'SENIOR_PRODUCT_MANAGER' &&
      signature.created_by.toString() !== session.user.id
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    signature.name = name;
    signature.body = signatureBody;
    await signature.save();

    const populated = await signature.populate('created_by', 'full_name email');
    return NextResponse.json(populated);
  } catch (error: any) {
    console.error(`Error in PUT /api/signatures/[id]:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
