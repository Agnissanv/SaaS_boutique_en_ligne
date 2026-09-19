import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Layout du compte client — version simplifiée
 * Moins de liens dans le header, plus cohérent avec la nouvelle page.
 */
export default async function CompteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/compte/connexion");
  }

  return (
    <div className="min-h-screen bg-brume">
      {/* Header simplifié */}
      <header className="sticky top-0 z-20 border-b border-ligne bg-white">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/keva-logo.jpg"
                alt="KEVA"
                className="h-8 w-8 rounded-md object-cover"
              />
            </Link>
            <span className="font-display text-base font-semibold text-encre">
              Mon compte
            </span>
          </div>

          <Link
            href="/"
            className="text-sm text-encre/60 hover:text-vert-actif"
          >
            Marketplace
          </Link>
        </div>
      </header>

      {/* Contenu */}
      <div className="mx-auto max-w-lg px-4 py-6">{children}</div>
    </div>
  );
}