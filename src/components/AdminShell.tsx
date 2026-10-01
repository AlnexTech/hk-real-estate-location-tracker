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
      <header className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <Link href="/">
            <img
              src="/hyperkidz-logo.png"
              alt="Hyper Kidz"
              className="brand-logo"
            />
          </Link>
          <h1 className="text-[22px] font-semibold tracking-tight text-[var(--ink)]">
            {title}
          </h1>
          <div className="sub">{lede}</div>
        </div>
        <AccountMenu />
      </header>
      {children}
    </div>
  );
}
