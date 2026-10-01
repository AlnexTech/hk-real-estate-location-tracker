"use client";

import { roleLabel } from "@/lib/roles";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Preview = {
  email: string;
  role: string;
  invitedBy: string;
  expiresAt: string;
};

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/invites/preview?token=${encodeURIComponent(token)}`,
        );
        const data = (await res.json()) as Preview & { error?: string };
        if (!res.ok) {
          if (!cancelled) setError(data.error || "This invite link is not valid.");
          return;
        }
        if (!cancelled) setPreview(data);
      } catch {
        if (!cancelled) setError("Could not load this invite.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <img src="/hyperkidz-logo.png" alt="Hyper Kidz" className="brand-logo" />
        <h1>Accept invite</h1>
        {loading && <p className="sub">Checking invite…</p>}
        {error && <div className="auth-error">{error}</div>}
        {preview && (
          <>
            <p className="sub">
              {preview.invitedBy} invited <strong>{preview.email}</strong> to the
              location tracker.
            </p>
            <div className="invite-role">
              <span>Role</span>
              <strong className={`role-badge ${preview.role}`}>
                {roleLabel(preview.role)}
              </strong>
            </div>
            <p className="sub">Set your name and password, then accept the invite.</p>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                setPending(true);
                setError("");
                try {
                  const res = await fetch("/api/invites/accept", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token, name, password }),
                  });
                  const data = (await res.json()) as { error?: string };
                  if (!res.ok) {
                    setError(data.error || "Could not accept the invite.");
                    setPending(false);
                    return;
                  }
                  router.push("/login?invited=1");
                } catch {
                  setError("Could not accept the invite.");
                  setPending(false);
                }
              }}
            >
              <div className="field">
                <label htmlFor="name">Your name</label>
                <input
                  id="name"
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <button type="submit" className="btn primary auth-submit" disabled={pending}>
                {pending ? "Accepting…" : "Accept invite"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
