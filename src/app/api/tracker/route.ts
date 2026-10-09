import { NextResponse } from "next/server";
import { getTrackerData } from "@/lib/tracker-service";
import { isAdminRole } from "@/lib/roles";
import { errorResponse, requireActor } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await requireActor();
    const data = await getTrackerData({
      includeLastEditor: isAdminRole(actor.role),
    });
    return NextResponse.json(data);
  } catch (error) {
    return errorResponse(error, "Failed to load tracker");
  }
}
