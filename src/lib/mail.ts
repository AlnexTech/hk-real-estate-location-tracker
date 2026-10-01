import { roleLabel } from "@/lib/roles";
import nodemailer, { type Transporter } from "nodemailer";

export class MailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MailError";
  }
}

type SmtpSettings = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
};

const MISSING_SMTP =
  "Email is not configured. Set SMTP_USER and SMTP_PASS (a Gmail app password) in .env.";

function smtpSettings(): SmtpSettings | null {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!user || !pass) return null;
  const port = Number(process.env.SMTP_PORT || 587);
  return {
    host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
    port: Number.isFinite(port) && port > 0 ? port : 587,
    user,
    pass,
    from: process.env.SMTP_FROM?.trim() || user,
  };
}

let transporter: Transporter | null = null;
let transporterKey = "";

function getTransporter(settings: SmtpSettings): Transporter {
  const key = `${settings.host}:${settings.port}:${settings.user}`;
  if (!transporter || transporterKey !== key) {
    transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.port === 465,
      auth: { user: settings.user, pass: settings.pass },
    });
    transporterKey = key;
  }
  return transporter;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function appBase(): string {
  return (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function sendInviteEmail(input: {
  to: string;
  role: string;
  invitedBy: string;
  url: string;
  expiresAt: Date;
}) {
  const settings = smtpSettings();
  if (!settings) throw new MailError(MISSING_SMTP);

  const role = roleLabel(input.role);
  const expires = input.expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const subject = `You're invited to the Hyper Kidz location tracker as ${role}`;
  const text = [
    `${input.invitedBy} invited you to the Hyper Kidz real estate location tracker.`,
    "",
    `Role: ${role}`,
    "",
    `Accept the invite: ${input.url}`,
    "",
    `This link expires on ${expires}.`,
  ].join("\n");
  const html = `
    <p>${escapeHtml(input.invitedBy)} invited you to the Hyper Kidz real estate location tracker.</p>
    <p><strong>Role:</strong> ${escapeHtml(role)}</p>
    <p><a href="${escapeHtml(input.url)}">Accept invite</a></p>
    <p>This link expires on ${escapeHtml(expires)}. If the button does not open, paste this address into your browser:</p>
    <p>${escapeHtml(input.url)}</p>
  `;

  await getTransporter(settings).sendMail({
    from: `"Hyper Kidz Tracker" <${settings.from}>`,
    to: input.to,
    subject,
    text,
    html,
  });
}

const ACTION_VERB: Record<string, string> = {
  create: "added",
  edit: "updated",
  delete: "deleted",
};

export async function sendActivityNotification(input: {
  actorName: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  entity: string;
  entityName?: string;
  summary: string;
}) {
  const to = process.env.ADMIN_NOTIFICATION_EMAIL?.trim();
  if (!to) return;

  const settings = smtpSettings();
  if (!settings) {
    console.error(`Skipped activity notification: ${MISSING_SMTP}`);
    return;
  }

  const verb = ACTION_VERB[input.action] || input.action;
  const target = input.entityName?.trim() || input.entity.replaceAll("_", " ");
  const who = `${input.actorName} (${roleLabel(input.actorRole)})`;
  const subject = `Tracker update: ${who} ${verb} ${target}`;
  const activityUrl = `${appBase()}/activity`;
  const text = [
    `${who} ${verb} ${target}.`,
    "",
    input.summary,
    "",
    `View activity: ${activityUrl}`,
  ].join("\n");
  const html = `
    <p><strong>${escapeHtml(who)}</strong> ${escapeHtml(verb)} <strong>${escapeHtml(target)}</strong>.</p>
    <p>${escapeHtml(input.summary)}</p>
    <p><a href="${escapeHtml(activityUrl)}">View activity</a></p>
  `;

  await getTransporter(settings).sendMail({
    from: `"Hyper Kidz Tracker" <${settings.from}>`,
    to,
    replyTo: input.actorEmail,
    subject,
    text,
    html,
  });
}
