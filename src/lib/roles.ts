import type { AppRole } from "@/types/next-auth";

export function roleLabel(role?: string | null): string {
  if (role === "admin") return "Admin";
  if (role === "agent") return "Real estate agent";
  return "Member";
}

export function isAppRole(value: unknown): value is AppRole {
  return value === "admin" || value === "agent";
}
