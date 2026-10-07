import { errorResponse, requireAdmin } from "@/lib/session";
import { resetUserPassword } from "@/lib/users";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Ctx) {
  try {
    const actor = await requireAdmin();
    const { id } = await context.params;
    const result = await resetUserPassword(actor, id);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error, "Failed to reset password");
  }
}
