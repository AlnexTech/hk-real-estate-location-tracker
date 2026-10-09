import { prisma } from "@/lib/db";
import { createInvite } from "@/lib/invites";
import { sendInviteEmail } from "@/lib/mail";
import { isAppRole, isSuperAdminRole } from "@/lib/roles";
import { errorResponse, requireAdmin } from "@/lib/session";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function inviteUrl(request: Request, token: string) {
  const configured = process.env.NEXTAUTH_URL?.replace(/\/$/, "");
  const origin = configured || new URL(request.url).origin;
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
        { error: "Choose a role" },
        { status: 400 },
      );
    }
    if (body.role === "super_admin" && !isSuperAdminRole(actor.role)) {
      return NextResponse.json(
        { error: "Only a super admin can invite a super admin." },
        { status: 403 },
      );
    }

    const { invite, token } = await createInvite(actor, email, body.role);
    const url = inviteUrl(request, token);
    let emailed = false;
    let emailError: string | undefined;
    try {
      await sendInviteEmail({
        to: invite.email,
        role: invite.role,
        invitedBy: actor.name,
        url,
        expiresAt: invite.expiresAt,
      });
      emailed = true;
    } catch (error) {
      console.error(error);
      emailError =
        error instanceof Error ? error.message : "Could not send the invite email.";
    }

    return NextResponse.json({
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt.toISOString(),
      },
      url,
      emailed,
      emailError,
    });
  } catch (error) {
    return errorResponse(error, "Failed to create invite");
  }
}
