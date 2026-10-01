import { prisma } from "@/lib/db";
import { errorResponse, HttpError, requireAdmin } from "@/lib/session";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: Ctx) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const invite = await prisma.invite.findUnique({ where: { id } });
    if (!invite || invite.acceptedAt) {
      throw new HttpError(404, "Invite not found");
    }
    await prisma.invite.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Failed to revoke invite");
  }
}
