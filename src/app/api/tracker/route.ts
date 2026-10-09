import { NextResponse } from "next/server";
import { getTrackerData } from "@/lib/tracker-service";
import { errorResponse, requireActor } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireActor();
    const data = await getTrackerData({ includeLastEditor: true });
    return NextResponse.json(data);
  } catch (error) {
    return errorResponse(error, "Failed to load tracker");
  }
}
