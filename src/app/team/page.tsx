import { TeamView } from "@/app/team/team-view";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export default async function TeamPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/team");
  if (session.user.role !== "admin") redirect("/");
  return <TeamView />;
}
