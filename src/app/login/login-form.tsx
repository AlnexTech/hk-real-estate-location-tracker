"use client";

import { ThemeToggle } from "@/components/ThemeToggle";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

function safeCallback(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const invited = params.get("invited") === "1";

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-top">
          <img src="/hyperkidz-logo.png" alt="Hyper Kidz" className="brand-logo" />
          <ThemeToggle />
        </div>
        <h1>Sign in</h1>
        <p className="sub">
          Hyper Kidz real estate location tracker. Accounts are created from an
          admin invite.
        </p>
        {invited && (
          <div className="auth-note">Account created. Sign in with your new password.</div>
        )}
        {error && <div className="auth-error">{error}</div>}
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError("");
            const result = await signIn("credentials", {
              email,
              password,
              redirect: false,
            });
            setPending(false);
            if (!result || result.error) {
              setError("Email or password is incorrect.");
              return;
            }
            router.push(safeCallback(params.get("callbackUrl")));
            router.refresh();
          }}
        >
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <button type="submit" className="btn primary auth-submit" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
