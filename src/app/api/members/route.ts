import { prisma } from "@/lib/db";
import { isAppRole } from "@/lib/roles";
import { errorResponse, requireAdmin } from "@/lib/session";
import { createUserAccount } from "@/lib/users";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const users = await prisma.user.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
    return NextResponse.json({
      members: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return errorResponse(error, "Failed to load members");
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

    const created = await createUserAccount(actor, email, body.role);
    return NextResponse.json(created);
  } catch (error) {
    return errorResponse(error, "Failed to create user");
  }
}
