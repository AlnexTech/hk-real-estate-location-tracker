import { ActivityView } from "@/app/activity/activity-view";
import { authOptions } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export default async function ActivityPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/activity");
  if (!isAdminRole(session.user.role)) redirect("/");
  return <ActivityView />;
}
