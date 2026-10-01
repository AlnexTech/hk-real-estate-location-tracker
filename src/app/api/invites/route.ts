import { prisma } from "@/lib/db";
import { createInvite } from "@/lib/invites";
import { isAppRole } from "@/lib/roles";
import { errorResponse, requireAdmin } from "@/lib/session";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function inviteUrl(request: Request, token: string) {
  const origin = new URL(request.url).origin;
  return `${origin}/invite/${token}`;
}

export async function GET() {
  try {
    await requireAdmin();
    const invites = await prisma.invite.findMany({
      where: { acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      include: { invitedBy: { select: { name: true } } },
    });
    return NextResponse.json({
      invites: invites.map((invite) => ({
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt.toISOString(),
        createdAt: invite.createdAt.toISOString(),
        invitedBy: invite.invitedBy.name,
      })),
    });
  } catch (error) {
    return errorResponse(error, "Failed to load invites");
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdmin();
    const body = (await request.json()) as { email?: string; role?: string };
    const email = body.email?.trim().toLowerCase() ?? "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Enter a valid email address" },
        { status: 400 },
      );
    }
    if (!isAppRole(body.role)) {
      return NextResponse.json(
        { error: "Choose Admin or Real estate agent" },
        { status: 400 },
      );
    }

    const { invite, token } = await createInvite(actor, email, body.role);
    return NextResponse.json({
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt.toISOString(),
      },
      url: inviteUrl(request, token),
    });
  } catch (error) {
    return errorResponse(error, "Failed to create invite");
  }
}
