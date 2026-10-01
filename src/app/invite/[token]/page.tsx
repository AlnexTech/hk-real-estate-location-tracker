import { AcceptInvite } from "@/app/invite/[token]/accept-form";

type Ctx = { params: Promise<{ token: string }> };

export default async function InvitePage({ params }: Ctx) {
  const { token } = await params;
  return <AcceptInvite token={token} />;
}
