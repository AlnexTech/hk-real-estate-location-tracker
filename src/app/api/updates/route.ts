import { NextResponse } from "next/server";
import { errorResponse, requireActor } from "@/lib/session";
import { postUpdate } from "@/lib/tracker-service";

export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    const body = (await request.json()) as { locId?: string; text?: string };
    const locId = body.locId?.trim();
    const text = body.text?.trim();
    if (!locId || !text) {
      return NextResponse.json(
        { error: "locId and text are required" },
        { status: 400 },
      );
    }
    const update = await postUpdate(locId, text, actor.name, true, actor);
    return NextResponse.json({ update });
  } catch (error) {
    return errorResponse(error, "Failed to post update");
  }
}
