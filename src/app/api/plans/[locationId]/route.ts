import { NextResponse } from "next/server";
import { errorResponse, requireActor } from "@/lib/session";
import { savePlan, startPlan } from "@/lib/tracker-service";
import type { LaunchPlan } from "@/lib/types";

type Ctx = { params: Promise<{ locationId: string }> };

export async function PUT(request: Request, context: Ctx) {
  try {
    const actor = await requireActor();
    const { locationId } = await context.params;
    const body = (await request.json()) as
      | { action: "start"; start: string }
      | { action?: "save"; plan: LaunchPlan };

    if (body.action === "start") {
      if (!body.start) {
        return NextResponse.json({ error: "start is required" }, { status: 400 });
      }
      const plan = await startPlan(locationId, body.start, actor);
      return NextResponse.json({ plan });
    }

    if (!("plan" in body) || !body.plan) {
      return NextResponse.json({ error: "plan is required" }, { status: 400 });
    }
    const plan = await savePlan(locationId, body.plan, actor);
    return NextResponse.json({ plan });
  } catch (error) {
    return errorResponse(error, "Failed to save plan");
  }
}
