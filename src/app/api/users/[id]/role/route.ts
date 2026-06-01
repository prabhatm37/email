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
    const { role } = body;

    if (!role || (role !== 'PRODUCT_MANAGER' && role !== 'SENIOR_PRODUCT_MANAGER')) {
      return NextResponse.json({ error: 'Invalid role value' }, { status: 400 });
    }

    if (id === session.user.id && role === 'PRODUCT_MANAGER') {
      return NextResponse.json({ error: 'Cannot demote yourself.' }, { status: 400 });
    }

    await connectDB();
    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    user.role = role;
    await user.save();

    const { password_hash, ...responseUser } = user.toObject();

    return NextResponse.json(responseUser);
  } catch (error: any) {
    console.error(`Error in PATCH /api/users/[id]/role:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
