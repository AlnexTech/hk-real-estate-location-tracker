import { prisma } from "@/lib/db";
import { errorResponse, requireAdmin } from "@/lib/session";
import { roleLabel } from "@/lib/roles";
import { ActivityAction } from "@/generated/prisma/client";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId")?.trim() || "";
    const action = url.searchParams.get("action")?.trim() || "";

    const actionFilter =
      action === ActivityAction.create ||
      action === ActivityAction.edit ||
      action === ActivityAction.delete
        ? action
        : undefined;

    const logs = await prisma.activityLog.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(actionFilter ? { action: actionFilter } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json({
      logs: logs.map((log) => ({
        id: log.id,
        userId: log.userId,
        actorName: log.actorName,
        actorEmail: log.actorEmail,
        actorRole: log.actorRole,
        roleLabel: roleLabel(log.actorRole),
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        entityName: log.entityName,
        summary: log.summary,
        createdAt: log.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return errorResponse(error, "Failed to load activity");
  }
}
