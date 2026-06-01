import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectDB from '@/lib/db/mongodb';
import Template from '@/lib/models/Template';

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

    template.status = status;
    await template.save();

    const populated = await template.populate('created_by', 'full_name email');
    return NextResponse.json(populated);
  } catch (error: any) {
    console.error(`Error in PATCH /api/templates/[id]/status:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
