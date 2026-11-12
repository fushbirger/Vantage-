import { redirect } from "next/navigation";
import { LoginScreen } from "@/components/LoginScreen";
import { getUsers } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/groups");
  const users = getUsers();
  return <LoginScreen users={users} />;
}
