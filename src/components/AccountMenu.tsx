"use client";

import { isAdminRole, roleLabel } from "@/lib/roles";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AccountMenu() {
  const { data } = useSession();
  const path = usePathname();
  const role = data?.user?.role;
  const isAdmin = isAdminRole(role);
  const name = data?.user?.name || "Signed in";
  const roleText = roleLabel(role);
  const showRole = roleText.toLowerCase() !== name.trim().toLowerCase();

  return (
    <div className="account-menu">
      {isAdmin && (
        <nav className="app-nav" aria-label="Workspace">
          <Link
            href="/activity"
            aria-current={path.startsWith("/activity") ? "page" : undefined}
          >
            Activity
          </Link>
          <Link
            href="/team"
            aria-current={path.startsWith("/team") ? "page" : undefined}
          >
            Team
          </Link>
        </nav>
      )}
      <span className="toolbar-rule" aria-hidden="true" />
      <div className="account-id">
        <span className="account-name">{name}</span>
        {showRole && (
          <span
            className={`role-badge${role === "admin" || role === "super_admin" ? ` ${role}` : ""}`}
          >
            {roleText}
          </span>
        )}
      </div>
      <button
        type="button"
        className="btn quiet"
        onClick={() => signOut({ callbackUrl: "/login" })}
      >
        Sign out
      </button>
    </div>
  );
}
