/**
 * Affichage étoiles réutilisable — extrait le 14/09/2026 de la page produit
 * (où il n'existait qu'en local) pour être partagé avec l'affichage de la
 * note de confiance au niveau boutique (voir src/lib/reviews.ts).
 */
export function Stars({ rating }: { rating: number }) {
  const rounded = Math.round(rating);
  return (
    <span aria-hidden="true" className="text-cuivre-profond">
      {"★".repeat(rounded)}
      <span className="text-ligne">{"★".repeat(5 - rounded)}</span>
    </span>
  );
}
