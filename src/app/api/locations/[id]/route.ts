import { NextResponse } from "next/server";
import { agentMayPatchLocation } from "@/lib/permissions";
import { isAdminRole } from "@/lib/roles";
import { errorResponse, requireActor, requireAdmin } from "@/lib/session";
import { deleteLocation, saveLocation } from "@/lib/tracker-service";
import type { Location } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Ctx) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const body = (await request.json()) as {
      patch?: Partial<Location>;
      logText?: string;
    };
    if (!body.patch || typeof body.patch !== "object") {
      return NextResponse.json({ error: "patch is required" }, { status: 400 });
    }
    if (!isAdminRole(actor.role) && !agentMayPatchLocation(body.patch)) {
      return NextResponse.json(
        { error: "Only an admin can edit those fields" },
        { status: 403 },
      );
    }
    const result = await saveLocation(id, body.patch, body.logText, actor);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error, "Failed to save location");
  }
}

export async function DELETE(_request: Request, context: Ctx) {
  try {
    const actor = await requireAdmin();
    const { id } = await context.params;
    await deleteLocation(id, actor);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Failed to delete location");
  }
}
