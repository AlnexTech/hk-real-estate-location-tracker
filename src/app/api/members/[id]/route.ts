import { errorResponse, requireSuperAdmin } from "@/lib/session";
import { deleteUserAccount } from "@/lib/users";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: Ctx) {
  try {
    const actor = await requireSuperAdmin();
    const { id } = await context.params;
    await deleteUserAccount(actor, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Failed to delete user");
  }
}
