import { UserRole } from "@/generated/prisma/client";
import type { AppRole } from "@/types/next-auth";

export function toUserRole(role: AppRole): UserRole {
  if (role === "super_admin") return UserRole.super_admin;
  if (role === "admin") return UserRole.admin;
  return UserRole.agent;
}

export function rolePhrase(role: AppRole): string {
  if (role === "super_admin") return "super admin";
  if (role === "admin") return "admin";
  return "real estate agent";
}
