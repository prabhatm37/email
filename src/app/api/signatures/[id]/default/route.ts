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

    if (signature.status === 'INACTIVE') {
      return NextResponse.json({ error: 'Cannot set an inactive signature as default.' }, { status: 400 });
    }

    // Clear default status on all other signatures for the owner of this signature
    await Signature.updateMany(
      { created_by: signature.created_by },
      { is_default: false }
    );

    // Set this signature as default
    signature.is_default = true;
    await signature.save();

    const populated = await signature.populate('created_by', 'full_name email');
    return NextResponse.json(populated);
  } catch (error: any) {
    console.error(`Error in PATCH /api/signatures/[id]/default:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
