import { prisma } from "@/lib/db";
import { HttpError, type Actor } from "@/lib/session";
import { toUserRole } from "@/lib/user-role";
import type { AppRole } from "@/types/next-auth";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";

const INVITE_MS = 7 * 24 * 60 * 60 * 1000;

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function inviteProblem(
  invite: { acceptedAt: Date | null; expiresAt: Date } | null,
): string | null {
  if (!invite) return "This invite link is not valid.";
  if (invite.acceptedAt) return "This invite has already been used.";
  if (invite.expiresAt.getTime() < Date.now()) {
    return "This invite has expired. Ask an admin for a new one.";
  }
  return null;
}

export async function createInvite(
  actor: Actor,
  email: string,
  role: AppRole,
) {
  const normalized = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) {
    throw new HttpError(409, "Someone with this email already has an account.");
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_MS);

  await prisma.invite.deleteMany({
    where: { email: normalized, acceptedAt: null },
  });

  const invite = await prisma.invite.create({
    data: {
      email: normalized,
      role: toUserRole(role),
      tokenHash: hashInviteToken(token),
      invitedById: actor.id,
      expiresAt,
    },
  });

  return { invite, token };
}

export async function getInviteByToken(token: string) {
  return prisma.invite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    include: { invitedBy: { select: { name: true } } },
  });
}

export async function acceptInvite(
  token: string,
  name: string,
  password: string,
) {
  const invite = await getInviteByToken(token);
  const problem = inviteProblem(invite);
  if (problem || !invite) throw new HttpError(400, problem || "This invite link is not valid.");

  const taken = await prisma.user.findUnique({ where: { email: invite.email } });
  if (taken) {
    throw new HttpError(409, "Someone with this email already has an account.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await prisma.$transaction([
    prisma.user.create({
      data: {
        email: invite.email,
        name: name.trim(),
        passwordHash,
        role: invite.role,
      },
    }),
    prisma.invite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    }),
  ]);

  return user;
}
