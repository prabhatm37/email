import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectDB from '@/lib/db/mongodb';
import Signature from '@/lib/models/Signature';

export async function PATCH(
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
    const { status } = body;

    if (!status || (status !== 'ACTIVE' && status !== 'INACTIVE')) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
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

    // If deactivating a default signature, warn/block or reset default to false.
    // In our case we can deactivate it but we must ensure we don't have is_default if it is inactive.
    if (status === 'INACTIVE' && signature.is_default) {
      signature.is_default = false;
    }

    signature.status = status;
    await signature.save();

    const populated = await signature.populate('created_by', 'full_name email');
    return NextResponse.json(populated);
  } catch (error: any) {
    console.error(`Error in PATCH /api/signatures/[id]/status:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
