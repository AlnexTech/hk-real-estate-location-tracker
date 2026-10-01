"use client";

import { AdminShell } from "@/components/AdminShell";
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
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

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
      lede="Invite an admin or a real estate agent. They get an email with a link to accept the role."
    >
      {error && <div className="auth-error">{error}</div>}
      <div className="team-grid">
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
            <span className={`role-badge ${member.role}`}>{roleLabel(member.role)}</span>
          </article>
        ))}
      </section>
    </AdminShell>
  );
}
