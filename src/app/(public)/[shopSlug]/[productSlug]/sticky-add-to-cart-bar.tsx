"use client";

const FMT_FCFA = new Intl.NumberFormat("fr-FR");

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
 * `bottom-16` (pas `bottom-0`) : la barre de navigation basse mobile
 * (`bottom-nav.tsx`) occupe déjà le bas de l'écran sur toutes les pages
 * client — cette barre vient se poser juste au-dessus, jamais superposée.
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
      <div className="fixed inset-x-0 bottom-16 z-30 flex items-center gap-3 border-t border-ligne bg-white px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] sm:hidden">
        <span className="font-mono text-base font-semibold text-vert-actif">
          {FMT_FCFA.format(price)} FCFA
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
