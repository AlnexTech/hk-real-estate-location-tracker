"use client";

import { roleLabel } from "@/lib/roles";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";

export function AccountMenu() {
  const { data } = useSession();
  const role = data?.user?.role;
  const isAdmin = role === "admin";

  return (
    <div className="account-menu">
      {isAdmin && (
        <>
          <Link href="/activity" className="btn">
            Activity
          </Link>
          <Link href="/team" className="btn">
            Team
          </Link>
        </>
      )}
      <div className="user-pill">
        <strong>{data?.user?.name || "Signed in"}</strong>
        <span>{roleLabel(role)}</span>
      </div>
      <button
        type="button"
        className="btn"
        onClick={() => signOut({ callbackUrl: "/login" })}
      >
        Sign out
      </button>
    </div>
  );
}
