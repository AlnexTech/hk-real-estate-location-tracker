import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { HttpError, type Actor } from "@/lib/session";
import type { AppRole } from "@/types/next-auth";
import { UserRole } from "@/generated/prisma/client";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";

const UPPERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWERS = "abcdefghijkmnpqrstuvwxyz";
const DIGITS = "23456789";

function pick(chars: string): string {
  return chars[randomInt(chars.length)] ?? chars[0];
}

function shuffle(value: string): string {
  const chars = value.split("");
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    const current = chars[i];
    chars[i] = chars[j] ?? current;
    chars[j] = current;
  }
  return chars.join("");
}

export function generatePassword(): string {
  const chars = [
    pick(UPPERS),
    pick(UPPERS),
    pick(UPPERS),
    pick(UPPERS),
    pick(LOWERS),
    pick(LOWERS),
    pick(LOWERS),
    pick(LOWERS),
    pick(DIGITS),
    pick(DIGITS),
    pick(DIGITS),
    pick(DIGITS),
  ];
  return shuffle(chars.join(""));
}

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const words = local
    .replace(/[._+-]+/g, " ")
    .replace(/[^a-zA-Z0-9 ]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  const name = words.join(" ");
  return name.length >= 2 ? name : email;
}

function isUniqueConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export async function createUserAccount(
  actor: Actor,
  email: string,
  role: AppRole,
) {
  const normalized = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) {
    throw new HttpError(409, "Someone with this email already has an account.");
  }

  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, 12);
  const userRole = role === "admin" ? UserRole.admin : UserRole.agent;

  let user;
  try {
    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: normalized,
          name: nameFromEmail(normalized),
          passwordHash,
          role: userRole,
        },
      });
      await tx.invite.deleteMany({
        where: { email: normalized, acceptedAt: null },
      });
      return created;
    });
  } catch (error) {
    if (isUniqueConflict(error)) {
      throw new HttpError(409, "Someone with this email already has an account.");
    }
    throw error;
  }

  try {
    await logActivity({
      actor,
      action: "create",
      entity: "user",
      entityId: user.id,
      entityName: user.email,
      summary: `Created a ${role === "admin" ? "admin" : "real estate agent"} account for ${user.email}`,
    });
  } catch (error) {
    console.error("Failed to record user creation", error);
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    },
    password,
  };
}

export async function resetUserPassword(actor: Actor, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(404, "Member not found");

  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  try {
    await logActivity({
      actor,
      action: "edit",
      entity: "user",
      entityId: user.id,
      entityName: user.email,
      summary: `Reset the password for ${user.email}`,
    });
  } catch (error) {
    console.error("Failed to record password reset", error);
  }

  return { email: user.email, password };
}
