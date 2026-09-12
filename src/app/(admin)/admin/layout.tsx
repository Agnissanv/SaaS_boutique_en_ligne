import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Layout admin — protège /admin/* et vérifie le rôle 'admin' sur le profil.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/connexion");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") redirect("/dashboard");

  return <div className="p-6">{children}</div>;
}
