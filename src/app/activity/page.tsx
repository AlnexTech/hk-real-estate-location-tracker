import { ActivityView } from "@/app/activity/activity-view";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export default async function ActivityPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/activity");
  if (session.user.role !== "admin") redirect("/");
  return <ActivityView />;
}
