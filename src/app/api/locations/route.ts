import { NextResponse } from "next/server";
import { addLocation } from "@/lib/tracker-service";
import { errorResponse, requireAdmin } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const actor = await requireAdmin();
    const body = (await request.json()) as { name?: string };
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const location = await addLocation(name, actor);
    return NextResponse.json({ location });
  } catch (error) {
    return errorResponse(error, "Failed to add location");
  }
}
