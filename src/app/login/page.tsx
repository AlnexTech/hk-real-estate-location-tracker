import { LoginForm } from "@/app/login/login-form";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session?.user) redirect("/");

  return (
    <Suspense fallback={<div className="auth-screen"><div className="sub">Loading…</div></div>}>
      <LoginForm />
    </Suspense>
  );
}
