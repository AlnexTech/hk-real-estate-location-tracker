"use client";

import { AdminShell } from "@/components/AdminShell";
import { Modal } from "@/components/Modal";
import { roleLabel } from "@/lib/roles";
import { useCallback, useEffect, useState } from "react";

type Member = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

type Invite = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  invitedBy: string;
};

export function TeamView() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "agent">("agent");
  const [createEmail, setCreateEmail] = useState("");
  const [createRole, setCreateRole] = useState<"admin" | "agent">("agent");
  const [credentials, setCredentials] = useState<{
    email: string;
    password: string;
    heading: string;
    note: string;
  } | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
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
      lede="Create an account with a generated password, or send an invite link."
    >
      {error && <div className="auth-error">{error}</div>}
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
                setCreateRole(event.target.value === "admin" ? "admin" : "agent")
              }
            >
              <option value="agent">Real estate agent</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <button type="submit" className="btn primary" disabled={creating}>
            {creating ? "Creating…" : "Create user"}
          </button>
        </form>
      </section>

      <div className="team-grid mt-4">
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
                  setRole(event.target.value === "admin" ? "admin" : "agent")
                }
              >
                <option value="agent">Real estate agent</option>
                <option value="admin">Admin</option>
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
        {members.map((member) => (
          <article key={member.id} className="member-row">
            <div>
              <strong>{member.name}</strong>
              <div className="sub">{member.email}</div>
            </div>
            <div className="member-actions">
              <span className={`role-badge ${member.role}`}>{roleLabel(member.role)}</span>
              <button
                type="button"
                className="btn"
                disabled={resettingId === member.id}
                onClick={async () => {
                  const confirmed = window.confirm(
                    `Reset the password for ${member.email}? Their current password will stop working.`,
                  );
                  if (!confirmed) return;
                  setResettingId(member.id);
                  setError("");
                  setNotice("");
                  try {
                    const res = await fetch(`/api/members/${member.id}/password`, {
                      method: "POST",
                    });
                    const data = (await res.json()) as {
                      email?: string;
                      password?: string;
                      error?: string;
                    };
                    if (!res.ok || !data.email || !data.password) {
                      throw new Error(data.error || "Could not reset the password");
                    }
                    setCredentials({
                      email: data.email,
                      password: data.password,
                      heading: "Password reset",
                      note: "Share this new password. It replaces the old one and is shown only once.",
                    });
                    setCopied(false);
                    setCopyError("");
                  } catch (err) {
                    setError(
                      err instanceof Error ? err.message : "Could not reset the password",
                    );
                  } finally {
                    setResettingId(null);
                  }
                }}
              >
                {resettingId === member.id ? "Resetting…" : "Reset password"}
              </button>
            </div>
          </article>
        ))}
      </section>

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
