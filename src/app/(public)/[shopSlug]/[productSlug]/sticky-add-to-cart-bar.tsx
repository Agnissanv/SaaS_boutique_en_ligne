"use client";

import { fcfa } from "@/lib/utils/money";

import { useEffect, useState } from "react";


/**
 * Barre "Ajouter au panier" fixe en bas d'écran sur mobile — ajoutée le
 * 16/09/2026 (constat après une analyse comparative avec la concurrence :
 * l'audience KEVA est ~90%+ mobile, or le seul bouton d'achat de la fiche
 * produit se trouve après les photos et la description, donc hors de portée
 * dès qu'on scrolle un peu).
 *
 * Ne duplique volontairement PAS la logique d'ajout au panier : la sélection
 * de variantes (taille/couleur) et la quantité vivent dans l'état local de
 * `AddToCartForm`, plus bas sur la page. Recréer cet état ici risquerait
 * d'ajouter au panier une configuration différente de celle que le client
 * croit avoir choisie (ex. il a sélectionné "Rouge, XL" dans le vrai
 * formulaire, cette barre ajouterait silencieusement la couleur par défaut).
 * Cette barre fait donc défiler jusqu'au vrai formulaire (`id="acheter"`,
 * voir page.tsx) plutôt que de le contourner — le prix affiché ici est le
 * prix de base du produit, pour donner un repère avant de scroller, pas le
 * prix final exact (qui peut varier selon les variantes choisies, calculé et
 * affiché dans le vrai formulaire).
 *
 * `sm:hidden` : masquée dès le breakpoint tablette, où la mise en page à
 * deux colonnes rend déjà le formulaire d'achat visible sans scroller.
 * Tout en bas de l'écran depuis le 13/10/2026 : la barre de navigation basse
 * n'est plus affichée sur la fiche produit (voir src/lib/bottom-nav-route.ts),
 * fini l'empilement de deux barres. Sa hauteur est publiée dans
 * `--sticky-cta-offset` pour que le bouton « remonter en haut » se pose
 * au-dessus.
 */
export function StickyAddToCartBar({
  price,
  stock,
  accentColor,
}: {
  price: number;
  stock: number;
  accentColor?: string | null;
}) {
  // Masquée tant que le vrai formulaire d'achat (#acheter) est à l'écran
  // (13/10/2026, audit visuel : on voyait deux fois « Ajouter au panier »).
  const [formInView, setFormInView] = useState(true);
  useEffect(() => {
    // Le formulaire #acheter est toujours rendu sur la fiche produit ; sans
    // lui, la barre reste simplement masquée.
    const form = document.getElementById("acheter");
    if (!form) return;
    const observer = new IntersectionObserver(([entry]) => setFormInView(entry.isIntersecting), {
      rootMargin: "0px 0px -40px 0px",
    });
    observer.observe(form);
    return () => observer.disconnect();
  }, []);

  const shown = stock > 0 && !formInView;
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--sticky-cta-offset", shown ? "68px" : "0px");
    return () => {
      root.style.setProperty("--sticky-cta-offset", "0px");
    };
  }, [shown]);

  if (stock <= 0) return null;

  function handleClick() {
    document.getElementById("acheter")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      {/* Cale de la même hauteur que la barre fixe ci-dessous, ajoutée à la
          fin du contenu de la page (voir page.tsx) — même principe que le
          spacer de bottom-nav.tsx, pour que le bas de la page (avis, produits
          similaires) ne finisse jamais masqué derrière les deux barres
          fixes empilées. */}
      <div className="h-[68px] sm:hidden" aria-hidden="true" />
      <div
        aria-hidden={!shown}
        className={`fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-ligne bg-white px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] shadow-[0_-2px_8px_rgba(0,0,0,0.06)] transition-transform duration-300 ease-out motion-reduce:transition-none sm:hidden ${
          shown ? "translate-y-0" : "pointer-events-none translate-y-full"
        }`}
      >
        <span className="font-mono text-base font-semibold text-vert-actif">
          {fcfa(price)}
        </span>
        <button
          type="button"
          onClick={handleClick}
          style={accentColor ? { backgroundColor: accentColor } : undefined}
          className={`ml-auto flex-1 rounded-xl px-4 py-2.5 text-sm font-bold text-ivoire shadow-[0_6px_14px_rgba(28,107,74,0.2)] transition ${
            accentColor ? "opacity-100 hover:opacity-90" : "bg-vert-actif hover:bg-vert-sapin"
          }`}
        >
          Ajouter au panier
        </button>
      </div>
    </>
  );
}
