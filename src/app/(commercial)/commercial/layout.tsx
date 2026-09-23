import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";

/**
 * Layout de l'espace commercial (23/09/2026, parrainage commercial — voir
 * decisions-techniques.md). Même structure que
 * (customer)/compte/(protected)/layout.tsx (header simplifié, pas de
 * sidebar — un seul écran, pas besoin d'une navigation dédiée) : ce n'est
 * pas un dashboard complet comme côté vendeur, juste un lien à copier et un
 * suivi de commissions.
 *
 * Garde de rôle explicite (comme (admin)/admin/layout.tsx) : un compte
 * commercial est créé PAR un admin (jamais d'auto-inscription, voir
 * admin/commerciaux/actions.ts) et se connecte via le même /connexion que
 * vendeurs/admin — `resolveHomePath` (auth-constants.ts) l'amène ici après
 * connexion, mais on revérifie le rôle ici aussi (défense en profondeur, même
 * principe que le layout admin) plutôt que de faire confiance uniquement à
 * la redirection de connexion.
 */
export default async function CommercialLayout({ children }: { children: React.ReactNode }) {
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

  if (profile?.role !== "commercial") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-brume">
      <header className="sticky top-0 z-20 border-b border-ligne bg-white">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <Link href="/commercial" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo statique */}
            <img src="/keva-logo.jpg" alt="KEVA" className="h-8 w-8 rounded-md object-cover" />
            <span className="font-display text-base font-semibold text-encre">Espace commercial</span>
          </Link>

          <form action={signOut}>
            <button type="submit" className="text-sm text-encre/60 underline hover:text-vert-actif">
              Déconnexion
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 py-6">{children}</div>
    </div>
  );
}
