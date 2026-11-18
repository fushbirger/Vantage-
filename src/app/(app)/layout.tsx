import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getAttentionCounts } from "@/lib/collab";
import { countUnreadNotifications } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const unread = countUnreadNotifications(user.id);
  const attention = getAttentionCounts(user.id);

  return (
    <AppShell
      user={{
        id: user.id,
        name: user.name,
        username: user.username,
        avatarColor: user.avatarColor,
      }}
      unread={unread}
      peopleBadge={attention.connections}
      groupsBadge={attention.invites}
    >
      {children}
    </AppShell>
  );
}
