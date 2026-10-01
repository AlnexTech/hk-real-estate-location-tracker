"use client";

import { AccountMenu } from "@/components/AccountMenu";
import Link from "next/link";
import type { ReactNode } from "react";

export function AdminShell({
  title,
  lede,
  children,
}: {
  title: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-brand">
          <Link href="/" className="brand-link">
            <img
              src="/hyperkidz-logo.png"
              alt="Hyper Kidz"
              className="brand-logo"
            />
          </Link>
          <div className="app-brand-copy">
            <h1>{title}</h1>
            <p className="sub">{lede}</p>
          </div>
        </div>
        <div className="app-toolbar">
          <Link href="/" className="back-link">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back
          </Link>
          <AccountMenu />
        </div>
      </header>
      {children}
    </div>
  );
}
