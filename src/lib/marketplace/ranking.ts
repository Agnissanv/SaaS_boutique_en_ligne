/**
 * Boost marketplace par palier d'abonnement — 22/09/2026, décision d'Isaac
 * suite à l'audit croissance ("les produits des boutiques Pro/Business
 * remontent plus... mais être un peu gentil aussi pour ceux qui ne payent
 * pas"). Voir migration 0042 pour `shops.plan_rank`/`shops.is_verified`
 * (dénormalisés, tenus à jour par trigger sur `subscriptions`).
 *
 * Algorithme "jour d'abord, palier ensuite" — répond aux DEUX exigences
 * d'Isaac à la fois avec une seule règle simple, sans score pondéré ni
 * nombre magique à calibrer :
 *
 *   1. Jour de publication (date seule, sans l'heure), décroissant : un
 *      article publié un jour plus récent passe TOUJOURS devant un article
 *      plus ancien, quel que soit le plan des deux boutiques. Une boutique
 *      Starter qui vient de publier n'est jamais enterrée sous un vieux
 *      produit Pro.
 *   2. À égalité de jour, `plan_rank` croissant (1=Pro, 2=Business,
 *      3=Starter) : entre deux articles publiés le même jour, celui de la
 *      boutique au palier le plus élevé passe devant — c'est ici, et
 *      seulement ici, que le boost joue.
 *   3. À égalité de jour ET de palier, date de création décroissante
 *      (départage final, ordre stable).
 *
 * Volontairement PAS un score continu mêlant ancienneté et palier : un tel
 * score aurait besoin d'un facteur de dégradation calibré à l'œil (combien
 * de jours d'ancienneté "valent" un palier de plus ?) qu'Isaac n'a jamais
 * spécifié et que je n'ai aucun moyen de valider empiriquement depuis cet
 * environnement — la règle jour/palier ci-dessus est plus simple, plus
 * explicable à Isaac, et ne peut jamais enterrer durablement une boutique
 * gratuite.
 *
 * Générique (extracteurs en paramètre plutôt qu'une forme figée) : réutilisé
 * à la fois sur les lignes brutes Supabase des bandes par catégorie et sur
 * celles de la grille filtrée (src/app/page.tsx), qui n'ont pas exactement
 * la même forme de `shop` embarqué (objet ou tableau selon le contexte de
 * requête).
 *
 * Portée v1 délibérément limitée à la PAGE déjà chargée : ceci ne fait que
 * réordonner les lignes DÉJÀ récupérées de la base (une bande, ou une page
 * de la grille paginée) — la pagination côté base (`.range(...)`) continue
 * de trier par `created_at desc` brut, donc le boost ne change jamais QUELS
 * articles atterrissent sur quelle page, seulement leur ordre à l'intérieur
 * d'une page. Compromis assumé et documenté (voir decisions-techniques.md)
 * plutôt qu'un tri boosté au niveau de la requête SQL elle-même, qui
 * aurait demandé d'ordonner par une colonne d'une table jointe
 * (`shop.plan_rank`) — comportement PostgREST que je n'ai aucun moyen de
 * vérifier en direct contre l'instance Supabase réelle d'Isaac depuis cet
 * environnement, donc écarté au profit de cette solution plus prudente
 * (lecture simple + tri en JS).
 */
export function boostByPlanWithinDay<T>(
  items: T[],
  getCreatedAt: (item: T) => string,
  getPlanRank: (item: T) => number
): T[] {
  const dayKey = (iso: string) => iso.slice(0, 10); // "AAAA-MM-JJ", suffisant pour un ISO 8601

  return [...items].sort((a, b) => {
    const createdA = getCreatedAt(a);
    const createdB = getCreatedAt(b);

    const dayA = dayKey(createdA);
    const dayB = dayKey(createdB);
    if (dayA !== dayB) return dayA > dayB ? -1 : 1;

    const rankA = getPlanRank(a);
    const rankB = getPlanRank(b);
    if (rankA !== rankB) return rankA - rankB;

    if (createdA === createdB) return 0;
    return createdA > createdB ? -1 : 1;
  });
}
