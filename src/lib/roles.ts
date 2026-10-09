import type { AppRole } from "@/types/next-auth";

export function roleLabel(role?: string | null): string {
  if (role === "super_admin") return "Super admin";
  if (role === "admin") return "Admin";
  if (role === "agent") return "Real estate agent";
  return "Member";
}

export function isAppRole(value: unknown): value is AppRole {
  return value === "super_admin" || value === "admin" || value === "agent";
}

/** Location, activity, invite, and team access shared by admin and super admin. */
export function isAdminRole(role?: string | null): boolean {
  return role === "admin" || role === "super_admin";
}

export function isSuperAdminRole(role?: string | null): boolean {
  return role === "super_admin";
}
