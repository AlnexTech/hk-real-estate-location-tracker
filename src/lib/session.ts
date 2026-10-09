import { authOptions } from "@/lib/auth";
import { isAdminRole, isAppRole, isSuperAdminRole } from "@/lib/roles";
import type { AppRole } from "@/types/next-auth";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export type Actor = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
};

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireActor(): Promise<Actor> {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  if (!user?.id || !user.email || !isAppRole(user.role)) {
    throw new HttpError(401, "Sign in required");
  }
  return {
    id: user.id,
    name: user.name?.trim() || user.email,
    email: user.email,
    role: user.role,
  };
}

export async function requireAdmin(): Promise<Actor> {
  const actor = await requireActor();
  if (!isAdminRole(actor.role)) {
    throw new HttpError(403, "Admins only");
  }
  return actor;
}

export async function requireSuperAdmin(): Promise<Actor> {
  const actor = await requireActor();
  if (!isSuperAdminRole(actor.role)) {
    throw new HttpError(403, "Super admins only");
  }
  return actor;
}

export function errorResponse(error: unknown, fallback: string) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: 500 },
  );
}
