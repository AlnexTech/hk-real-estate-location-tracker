"use client";

import { AdminShell } from "@/components/AdminShell";
import { Modal } from "@/components/Modal";
import { daysSince } from "@/lib/constants";
import { isSuperAdminRole, roleLabel } from "@/lib/roles";
import type { AppRole } from "@/types/next-auth";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

type Member = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  daysSinceUpdate?: number | null;
};

function daysWithoutUpdate(member: Member): { text: string; stale: boolean } {
  const sinceUpdate = member.daysSinceUpdate;
  if (sinceUpdate === null || sinceUpdate === undefined) {
    const sinceJoin = daysSince(member.createdAt) ?? 0;
    if (sinceJoin <= 0) {
      return { text: "Never updated location details", stale: true };
    }
    return {
      text:
        sinceJoin === 1
          ? "1 day without a location update"
          : `${sinceJoin} days without a location update`,
      stale: true,
    };
  }
  if (sinceUpdate <= 0) return { text: "Updated location details today", stale: false };
  if (sinceUpdate === 1) return { text: "1 day without a location update", stale: false };
  return {
    text: `${sinceUpdate} days without a location update`,
    stale: sinceUpdate >= 7,
  };
}

type Invite = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  invitedBy: string;
};

const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function suggestPassword(): string {
  const values = new Uint32Array(12);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => PASSWORD_CHARS[value % PASSWORD_CHARS.length]).join("");
}

function assignableRole(value: string, allowSuperAdmin: boolean): AppRole {
  if (value === "super_admin" && allowSuperAdmin) return "super_admin";
  if (value === "admin") return "admin";
  return "agent";
}

export function TeamView() {
  const { data: session } = useSession();
  const superAdmin = isSuperAdminRole(session?.user?.role);
  const selfId = session?.user?.id;
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("agent");
  const [createEmail, setCreateEmail] = useState("");
  const [createRole, setCreateRole] = useState<AppRole>("agent");
  const [credentials, setCredentials] = useState<{
    email: string;
    password: string;
    heading: string;
    note: string;
  } | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<Member | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const [memberRes, inviteRes] = await Promise.all([
      fetch("/api/members"),
      fetch("/api/invites"),
    ]);
    const memberData = (await memberRes.json()) as {
      members?: Member[];
      error?: string;
    };
    const inviteData = (await inviteRes.json()) as {
      invites?: Invite[];
      error?: string;
    };
    if (!memberRes.ok) throw new Error(memberData.error || "Failed to load members");
    if (!inviteRes.ok) throw new Error(inviteData.error || "Failed to load invites");
    setMembers(memberData.members || []);
    setInvites(inviteData.invites || []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load team");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  return (
    <AdminShell
      title="Team"
      lede={
        superAdmin
          ? "Create accounts, set passwords, remove users, or send an invite."
          : "Send an invite link so someone can join the tracker."
      }
    >
      {error && <div className="auth-error">{error}</div>}
      {superAdmin && (
      <section className="panel-card">
        <h2>Create a user</h2>
        <p className="sub create-user-note">
          Enter an email. A password is generated so they can sign in right away.
          You will see it once.
        </p>
        <form
          className="invite-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setCreating(true);
            setError("");
            setNotice("");
            try {
              const res = await fetch("/api/members", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: createEmail, role: createRole }),
              });
              const data = (await res.json()) as {
                user?: Member;
                password?: string;
                error?: string;
              };
              if (!res.ok || !data.user || !data.password) {
                throw new Error(data.error || "Could not create the user");
              }
              setCredentials({
                email: data.user.email,
                password: data.password,
                heading: "User created",
                note: "Share these sign-in details. This password is shown only once.",
              });
              setCopied(false);
              setCopyError("");
              setCreateEmail("");
              await load();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not create the user");
            } finally {
              setCreating(false);
            }
          }}
        >
          <label>
            Email
            <input
              type="email"
              required
              value={createEmail}
              autoComplete="off"
              onChange={(event) => setCreateEmail(event.target.value)}
            />
          </label>
          <label>
            Role
            <select
              value={createRole}
              onChange={(event) =>
                setCreateRole(assignableRole(event.target.value, true))
              }
            >
              <option value="agent">Real estate agent</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super admin</option>
            </select>
          </label>
          <button type="submit" className="btn primary" disabled={creating}>
            {creating ? "Creating…" : "Create user"}
          </button>
        </form>
      </section>
      )}

      <div className={`team-grid${superAdmin ? " mt-4" : ""}`}>
        <section className="panel-card">
          <h2>Invite someone</h2>
          <form
            className="invite-form"
            onSubmit={async (event) => {
              event.preventDefault();
              setPending(true);
              setError("");
              setNotice("");
              setLink("");
              try {
                const res = await fetch("/api/invites", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email, role }),
                });
                const data = (await res.json()) as {
                  url?: string;
                  emailed?: boolean;
                  emailError?: string;
                  error?: string;
                };
                if (!res.ok) throw new Error(data.error || "Could not create the invite");
                const sentTo = email;
                setLink(data.url || "");
                setEmail("");
                if (data.emailed) {
                  setNotice(
                    `Invite emailed to ${sentTo}. The link is also shown below in case it lands in spam.`,
                  );
                } else {
                  setError(
                    data.emailError ||
                      "The invite was created, but the email could not be sent. Copy the link instead.",
                  );
                }
                await load();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not create the invite");
              } finally {
                setPending(false);
              }
            }}
          >
            <label>
              Email
              <input
                type="email"
                required
                value={email}
                autoComplete="off"
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label>
              Role
              <select
                value={role}
                onChange={(event) =>
                  setRole(assignableRole(event.target.value, superAdmin))
                }
              >
                <option value="agent">Real estate agent</option>
                <option value="admin">Admin</option>
                {superAdmin && <option value="super_admin">Super admin</option>}
              </select>
            </label>
            <button type="submit" className="btn primary" disabled={pending}>
              {pending ? "Sending…" : "Send invite"}
            </button>
          </form>
          {notice && <p className="auth-note">{notice}</p>}
          {link && (
            <div className="invite-link">
              <input readOnly value={link} onFocus={(event) => event.currentTarget.select()} />
              <button
                type="button"
                className="btn"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link);
                    setNotice("Invite link copied.");
                  } catch {
                    setNotice("Select the link and copy it manually.");
                  }
                }}
              >
                Copy
              </button>
            </div>
          )}
        </section>

        <section className="panel-card">
          <h2>Pending invites</h2>
          {invites.length === 0 && (
            <div className="sub">No open invites. A new invite replaces an older one for the same email.</div>
          )}
          {invites.map((invite) => (
            <article key={invite.id} className="member-row">
              <div>
                <strong>{invite.email}</strong>
                <div className="sub">
                  {roleLabel(invite.role)} · invited by {invite.invitedBy} · expires{" "}
                  {new Date(invite.expiresAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              </div>
              <button
                type="button"
                className="btn"
                onClick={async () => {
                  setError("");
                  const res = await fetch(`/api/invites/${invite.id}`, {
                    method: "DELETE",
                  });
                  if (!res.ok) {
                    const data = (await res.json()) as { error?: string };
                    setError(data.error || "Could not revoke invite");
                    return;
                  }
                  setInvites((prev) => prev.filter((item) => item.id !== invite.id));
                }}
              >
                Revoke
              </button>
            </article>
          ))}
        </section>
      </div>

      <section className="panel-card mt-4">
        <h2>Members</h2>
        {members.map((member) => {
          const gap = member.role === "agent" ? daysWithoutUpdate(member) : null;
          return (
          <article key={member.id} className="member-row">
            <div>
              <strong>{member.name}</strong>
              <div className="sub">{member.email}</div>
              {gap && (
                <div className={`days-since${gap.stale ? " is-stale" : ""}`}>{gap.text}</div>
              )}
            </div>
            <div className="member-actions">
              <span className={`role-badge ${member.role}`}>{roleLabel(member.role)}</span>
              {superAdmin && (
                <button
                  type="button"
                  className="btn"
                  disabled={resettingId !== null || deletingId !== null}
                  onClick={() => {
                    setPasswordTarget(member);
                    setNextPassword("");
                    setPasswordError("");
                    setError("");
                  }}
                >
                  Set password
                </button>
              )}
              {superAdmin && member.id !== selfId && (
                <button
                  type="button"
                  className="btn danger"
                  disabled={resettingId !== null || deletingId !== null}
                  onClick={() => {
                    setDeleteTarget(member);
                    setDeleteError("");
                    setError("");
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          </article>
          );
        })}
      </section>

      <Modal
        open={passwordTarget !== null}
        onClose={() => {
          if (resettingId) return;
          setPasswordTarget(null);
        }}
      >
        {passwordTarget && (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const password = nextPassword.trim();
              if (password.length < 8) {
                setPasswordError("Password must be at least 8 characters");
                return;
              }
              setResettingId(passwordTarget.id);
              setPasswordError("");
              setError("");
              setNotice("");
              try {
                const res = await fetch(`/api/members/${passwordTarget.id}/password`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ password }),
                });
                const data = (await res.json()) as {
                  email?: string;
                  password?: string;
                  error?: string;
                };
                if (!res.ok || !data.email || !data.password) {
                  throw new Error(data.error || "Could not set the password");
                }
                setPasswordTarget(null);
                setNextPassword("");
                setCredentials({
                  email: data.email,
                  password: data.password,
                  heading: "Password set",
                  note: "Share this password. It replaces the old one and is shown only once.",
                });
                setCopied(false);
                setCopyError("");
              } catch (err) {
                setPasswordError(
                  err instanceof Error ? err.message : "Could not set the password",
                );
              } finally {
                setResettingId(null);
              }
            }}
          >
            <h3>Set password</h3>
            <p className="sub">
              Choose a password for {passwordTarget.email}. It replaces the current one.
            </p>
            {passwordError && <div className="auth-error">{passwordError}</div>}
            <div className="f" style={{ marginTop: 8 }}>
              <label htmlFor="member-password">New password</label>
              <input
                id="member-password"
                type="text"
                autoComplete="off"
                value={nextPassword}
                onChange={(event) => setNextPassword(event.target.value)}
              />
            </div>
            <div className="mrow">
              <button
                type="button"
                className="btn"
                disabled={resettingId !== null}
                onClick={() => setPasswordTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                disabled={resettingId !== null}
                onClick={() => {
                  setNextPassword(suggestPassword());
                  setPasswordError("");
                }}
              >
                Generate
              </button>
              <button type="submit" className="btn primary" disabled={resettingId !== null}>
                {resettingId ? "Saving…" : "Set password"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => {
          if (deletingId) return;
          setDeleteTarget(null);
        }}
      >
        {deleteTarget && (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setDeletingId(deleteTarget.id);
              setDeleteError("");
              setError("");
              try {
                const res = await fetch(`/api/members/${deleteTarget.id}`, {
                  method: "DELETE",
                });
                const data = (await res.json().catch(() => null)) as { error?: string } | null;
                if (!res.ok) {
                  throw new Error(data?.error || "Could not delete the user");
                }
                setMembers((prev) => prev.filter((member) => member.id !== deleteTarget.id));
                setDeleteTarget(null);
                setNotice(`Deleted the account for ${deleteTarget.email}.`);
              } catch (err) {
                setDeleteError(err instanceof Error ? err.message : "Could not delete the user");
              } finally {
                setDeletingId(null);
              }
            }}
          >
            <h3>Delete user</h3>
            <p className="sub">
              Delete the account for {deleteTarget.email}. They will not be able to sign in.
            </p>
            {deleteError && <div className="auth-error">{deleteError}</div>}
            <div className="mrow">
              <button
                type="button"
                className="btn"
                disabled={deletingId !== null}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button type="submit" className="btn danger" disabled={deletingId !== null}>
                {deletingId ? "Deleting…" : "Delete user"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={credentials !== null}
        dismissible={false}
        className="credentials"
        onClose={() => setCredentials(null)}
      >
        {credentials && (
          <>
            <h3>{credentials.heading}</h3>
            <p className="sub">{credentials.note}</p>
            <div className="credential-list">
              <div>
                <span>Email</span>
                <strong>{credentials.email}</strong>
              </div>
              <div>
                <span>Password</span>
                <strong>{credentials.password}</strong>
              </div>
            </div>
            {copyError && <div className="auth-error">{copyError}</div>}
            <div className="mrow">
              <button
                type="button"
                className="btn"
                onClick={() => setCredentials(null)}
              >
                Done
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={async () => {
                  const text = `Email: ${credentials.email}\nPassword: ${credentials.password}`;
                  try {
                    await navigator.clipboard.writeText(text);
                    setCopied(true);
                    setCopyError("");
                  } catch {
                    setCopied(false);
                    setCopyError("Could not copy automatically. Select the details and copy them.");
                  }
                }}
              >
                {copied ? "Copied" : "Copy email and password"}
              </button>
            </div>
          </>
        )}
      </Modal>
    </AdminShell>
  );
}
