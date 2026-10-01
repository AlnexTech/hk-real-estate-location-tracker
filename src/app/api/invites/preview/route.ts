import { getInviteByToken, inviteProblem } from "@/lib/invites";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim() ?? "";
  if (!token) {
    return NextResponse.json({ error: "This invite link is not valid." }, { status: 400 });
  }
  const invite = await getInviteByToken(token);
  const problem = inviteProblem(invite);
  if (problem || !invite) {
    return NextResponse.json({ error: problem || "This invite link is not valid." }, { status: 400 });
  }
  return NextResponse.json({
    email: invite.email,
    role: invite.role,
    invitedBy: invite.invitedBy.name,
    expiresAt: invite.expiresAt.toISOString(),
  });
}
