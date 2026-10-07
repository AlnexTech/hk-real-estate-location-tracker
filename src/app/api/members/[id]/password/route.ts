import { errorResponse, requireAdmin } from "@/lib/session";
import { resetUserPassword } from "@/lib/users";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  try {
    const actor = await requireAdmin();
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as { password?: string } | null;
    const password = typeof body?.password === "string" ? body.password : "";
    const result = await resetUserPassword(actor, id, password);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error, "Failed to reset password");
  }
}
