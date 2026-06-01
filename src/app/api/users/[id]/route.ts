import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'SENIOR_PRODUCT_MANAGER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await ctx.params;

    await connectDB();
    const user = await User.findById(id).select('-password_hash');
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error: any) {
    console.error(`Error in GET /api/users/[id]:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(
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
    const { full_name, role, login_method } = body;

    if (!full_name || !role || !login_method) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check that we aren't modifying ourselves to be a Product Manager if we are the only SPM
    if (id === session.user.id && role !== 'SENIOR_PRODUCT_MANAGER') {
      return NextResponse.json({ error: 'Cannot demote yourself.' }, { status: 400 });
    }

    await connectDB();
    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    user.full_name = full_name;
    user.role = role;
    user.login_method = login_method;

    await user.save();

    const { password_hash, ...responseUser } = user.toObject();

    return NextResponse.json(responseUser);
  } catch (error: any) {
    console.error(`Error in PUT /api/users/[id]:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
