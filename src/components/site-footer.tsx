"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Pied de page global — ajouté le 29/09/2026 : jusqu'ici KEVA n'avait aucun
 * footer nulle part sur le site public (vérifié par grep avant de coder,
 * voir decisions-techniques.md), alors que la page de référence partagée
 * par Isaac en avait un. Monté une seule fois dans `layout.tsx` (après
 * `{children}`) plutôt que dans `page.tsx`, pour qu'il apparaisse sur
 * toutes les pages publiques (boutique, produit, blog...), pas seulement
 * l'accueil.
 *
 * `HIDDEN_ROOTS` reprend exactement la liste de `bottom-nav.tsx` (même
 * raisonnement : portails d'authentification et espaces internes
 * vendeur/admin ont déjà leur propre gabarit, un footer marketing y serait
 * hors de propos) — un seul pied de page marketing pour toutes les surfaces
 * publiques, jamais dans un dashboard ou un écran de connexion.
 *
 * Uniquement de vrais liens internes déjà existants (`/categories`,
 * `/inscription`, `/charte-vendeur`, `/contact`, `/conditions-utilisation`,
 * `/politique-confidentialite`, `/blog`, `/faq` depuis le 02/10/2026) et la
 * vraie adresse de contact
 * (`contact@shopkeva.com`, voir `politique-confidentialite/page.tsx`) —
 * aucune icône de réseau social : aucun lien officiel (Facebook/Instagram/
 * TikTok) n'est encore documenté quelque part dans le projet à ce jour,
 * jamais d'URL inventée ici.
 *
 * `bg-vert-profond` (le vert le plus sombre de la charte) plutôt que
 * `bg-white`/`bg-brume` du reste du site : un footer sombre referme
 * visuellement la page, et réutilise un token déjà existant plutôt que
 * d'en introduire un nouveau.
 */
const FOOTER_LINK_GROUPS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Marketplace",
    links: [
      { label: "Catégories", href: "/categories" },
      { label: "Blog", href: "/blog" },
    ],
  },
  {
    title: "Vendeurs",
    links: [
      { label: "Ouvrir ma boutique", href: "/inscription" },
      { label: "Charte vendeur", href: "/charte-vendeur" },
    ],
  },
  {
    title: "Aide",
    links: [
      { label: "Questions fréquentes", href: "/faq" },
      { label: "Nous contacter", href: "/contact" },
      { label: "Conditions d'utilisation", href: "/conditions-utilisation" },
      { label: "Politique de confidentialité", href: "/politique-confidentialite" },
    ],
  },
];

const HIDDEN_ROOTS = new Set([
  "connexion",
  "inscription",
  "admin",
  "dashboard",
  "auth",
  "api",
]);

export function SiteFooter() {
  const pathname = usePathname();
  const firstSegment = pathname?.split("/")[1] ?? "";
  const year = new Date().getFullYear();

  if (HIDDEN_ROOTS.has(firstSegment)) return null;

  return (
    <footer className="mt-auto bg-vert-profond text-ivoire">
      {/* `pb-24` (au lieu de `pb-12`) sur mobile : compense la barre de
          navigation basse fixe (`bottom-nav.tsx`, `fixed bottom-0`) qui
          recouvrirait sinon les derniers liens du footer — masquée dès
          `sm:`, où `pb-12` suffit. */}
      <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-12 sm:px-6 sm:pb-12">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- logo statique */}
              <img src="/keva-logo.jpg" alt="KEVA" className="h-8 w-8 rounded-md object-cover" />
              <span className="font-display text-lg font-bold tracking-wide text-white">
                KEVA
              </span>
            </Link>
            <p className="mt-3 max-w-[22ch] text-sm text-ivoire/70">
              La marketplace des vendeurs indépendants de Côte d&apos;Ivoire.
            </p>
          </div>

          {FOOTER_LINK_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-ivoire/50">
                {group.title}
              </p>
              <ul className="mt-3 flex flex-col gap-2.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-ivoire/80 transition hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-ivoire/15 pt-6 text-xs text-ivoire/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} KEVA. Tous droits réservés.</p>
          <a href="mailto:contact@shopkeva.com" className="transition hover:text-ivoire/80">
            contact@shopkeva.com
          </a>
        </div>
      </div>
    </footer>
  );
}
