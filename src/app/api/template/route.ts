import { NextResponse } from "next/server";
import { errorResponse, requireAdmin } from "@/lib/session";
import { saveTemplateFromPlan } from "@/lib/tracker-service";

export async function PUT(request: Request) {
  try {
    const actor = await requireAdmin();
    const body = (await request.json()) as { locationId?: string };
    if (!body.locationId) {
      return NextResponse.json(
        { error: "locationId is required" },
        { status: 400 },
      );
    }
    const template = await saveTemplateFromPlan(body.locationId, actor);
    return NextResponse.json({ template });
  } catch (error) {
    return errorResponse(error, "Failed to save template");
  }
}
