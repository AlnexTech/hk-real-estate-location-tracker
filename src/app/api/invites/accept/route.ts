import { acceptInvite } from "@/lib/invites";
import { errorResponse } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token?: string;
      name?: string;
      password?: string;
    };
    const token = body.token?.trim() ?? "";
    const name = body.name?.trim() ?? "";
    const password = body.password ?? "";
    if (!token) {
      return NextResponse.json({ error: "This invite link is not valid." }, { status: 400 });
    }
    if (name.length < 2) {
      return NextResponse.json({ error: "Enter your name" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }
    await acceptInvite(token, name, password);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Failed to accept invite");
  }
}
