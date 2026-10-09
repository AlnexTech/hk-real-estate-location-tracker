"use client";

import { AdminShell } from "@/components/AdminShell";
import { roleLabel } from "@/lib/roles";
import { useEffect, useState } from "react";

type Member = { id: string; name: string; email: string; role: string };
type Log = {
  id: string;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  entityName: string | null;
  summary: string;
  createdAt: string;
};

export function ActivityView() {
  const [members, setMembers] = useState<Member[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("");
  const [sort, setSort] = useState("newest");
  const [action, setAction] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/members");
        const data = (await res.json()) as { members?: Member[]; error?: string };
        if (!res.ok) throw new Error(data.error || "Failed to load members");
        if (!cancelled) setMembers(data.members || []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load members");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (userId) params.set("userId", userId);
        if (role) params.set("role", role);
        if (sort === "oldest") params.set("sort", "oldest");
        if (action) params.set("action", action);
        const res = await fetch(`/api/activity?${params.toString()}`);
        const data = (await res.json()) as { logs?: Log[]; error?: string };
        if (!res.ok) throw new Error(data.error || "Failed to load activity");
        if (!cancelled) {
          setLogs(data.logs || []);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load activity");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, role, sort, action]);

  const visibleMembers = role
    ? members.filter((member) => member.role === role)
    : members;

  return (
    <AdminShell
      title="Edit activity"
      lede="Every location, update, and launch-plan change, across the whole team."
    >
      <div className="panel-card mb-4">
        <div className="filter-row">
          <label>
            User
            <select value={userId} onChange={(event) => setUserId(event.target.value)}>
              <option value="">Everyone</option>
              {visibleMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} · {roleLabel(member.role)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Role
            <select
              value={role}
              onChange={(event) => {
                const next = event.target.value;
                setRole(next);
                if (!next) return;
                setUserId((current) => {
                  const member = members.find((item) => item.id === current);
                  return member && member.role !== next ? "" : current;
                });
              }}
            >
              <option value="">All roles</option>
              <option value="super_admin">Super admin</option>
              <option value="admin">Admin</option>
              <option value="agent">Real estate agent</option>
            </select>
          </label>
          <label>
            Sort
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="newest">Last update, newest</option>
              <option value="oldest">Last update, oldest</option>
            </select>
          </label>
          <label>
            Action
            <select value={action} onChange={(event) => setAction(event.target.value)}>
              <option value="">All actions</option>
              <option value="create">Created</option>
              <option value="edit">Edited</option>
              <option value="delete">Deleted</option>
            </select>
          </label>
        </div>
      </div>
      {error && <div className="auth-error">{error}</div>}
      <div className="panel-card">
        {loading && <div className="sub">Loading activity…</div>}
        {!loading && logs.length === 0 && (
          <div className="sub">No edits match these filters yet.</div>
        )}
        {logs.map((log) => (
          <article key={log.id} className="activity-row">
            <div className="activity-meta">
              <span className={`role-badge ${log.actorRole}`}>
                {roleLabel(log.actorRole)}
              </span>
              <span className={`action-badge ${log.action}`}>{log.action}</span>
              <time dateTime={log.createdAt}>
                {new Date(log.createdAt).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </time>
            </div>
            <div>
              <strong>{log.actorName}</strong>
              <span className="sub"> {log.actorEmail}</span>
              <p>{log.summary}</p>
            </div>
          </article>
        ))}
      </div>
    </AdminShell>
  );
}
