import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
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

  return (
    <AppShell
      user={{
        id: user.id,
        name: user.name,
        username: user.username,
        avatarColor: user.avatarColor,
      }}
      unread={unread}
    >
      {children}
    </AppShell>
  );
}
