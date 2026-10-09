import { TeamView } from "@/app/team/team-view";
import { authOptions } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export default async function TeamPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/team");
  if (!isAdminRole(session.user.role)) redirect("/");
  return <TeamView />;
}
