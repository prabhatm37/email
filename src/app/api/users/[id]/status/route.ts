import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'SENIOR_PRODUCT_MANAGER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await ctx.params;
    const body = await req.json();
    const { status } = body;

    if (!status || (status !== 'ACTIVE' && status !== 'INACTIVE')) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    if (id === session.user.id && status === 'INACTIVE') {
      return NextResponse.json({ error: 'Cannot deactivate yourself.' }, { status: 400 });
    }

    await connectDB();
    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    user.status = status;
    await user.save();

    const { password_hash, ...responseUser } = user.toObject();

    return NextResponse.json(responseUser);
  } catch (error: any) {
    console.error(`Error in PATCH /api/users/[id]/status:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
