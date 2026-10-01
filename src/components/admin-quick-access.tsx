"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { HIDDEN_ROOTS } from "./bottom-nav";

/**
 * Raccourci "Espace admin" — ajouté le 01/10/2026, retour d'Isaac : connecté
 * en tant qu'admin, il arrive qu'il se retrouve sur l'interface visiteur
 * (accueil marketplace, page boutique...) sans aucun moyen d'y revenir. Rien
 * ne le proposait : `layout.tsx` n'a pas de header partagé sur les pages
 * publiques (chaque page compose le sien), et la seule nav persistante
 * (`BottomNav`) pointe vers `/compte`, pas `/admin`.
 *
 * Vérification du rôle faite ICI, côté client, avec le client Supabase du
 * navigateur — PAS dans `layout.tsx` (Server Component racine, monté sur
 * TOUTE page publique) : y ajouter un `auth.getUser()` + lecture de profil
 * ferait payer une requête à CHAQUE visiteur anonyme de la marketplace juste
 * pour cet affichage admin, qui ne concerne qu'un seul compte. Ici, la
 * requête ne part que s'il existe déjà une session (`getSession()`, lu
 * localement, pas d'appel réseau pour un visiteur anonyme), et ce bouton
 * n'est qu'un confort d'affichage — `/admin` reste de toute façon protégé
 * et revérifié côté serveur (`(admin)/admin/layout.tsx`), donc aucun enjeu de
 * sécurité à le calculer ainsi.
 *
 * Caché sur les mêmes racines que `BottomNav` (réutilise `HIDDEN_ROOTS`) :
 * inutile sur `/admin` (déjà dessus) ou sur un portail d'authentification.
 */
export function AdminQuickAccess() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user || cancelled) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!cancelled && profile?.role === "admin") setIsAdmin(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!isAdmin) return null;

  const first = pathname.split("/").filter(Boolean)[0];
  if (first !== undefined && HIDDEN_ROOTS.has(first)) return null;

  return (
    <Link
      href="/admin"
      className="fixed right-3 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-40 flex items-center gap-1.5 rounded-full bg-vert-sapin px-3 py-2 text-xs font-medium text-ivoire shadow-[0_6px_14px_rgba(4,20,15,0.3)] transition hover:bg-vert-profond"
    >
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="M10 2.5 3.5 6v4c0 4 2.8 6.5 6.5 7.5 3.7-1 6.5-3.5 6.5-7.5V6L10 2.5Z" />
      </svg>
      Espace admin
    </Link>
  );
}
