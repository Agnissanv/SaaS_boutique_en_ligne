/**
 * Composants de visualisation pour `/dashboard/statistiques` (16/09/2026) —
 * SVG dessiné à la main plutôt qu'une librairie de graphiques : aucune
 * dépendance npm n'a été ajoutée à ce projet jusqu'ici (voir
 * `src/lib/email/brevo.ts`, même raisonnement pour l'envoi d'email), et une
 * nouvelle dépendance nécessiterait qu'Isaac relance `npm install` et
 * régénère son lockfile avant le prochain déploiement Vercel — risque
 * évitable pour des graphiques simples (une courbe, des barres).
 */

const FMT_FCFA = new Intl.NumberFormat("fr-FR");

/**
 * Courbe — un point par jour, aire teintée sous la ligne. Sert à la fois
 * pour le CA et pour le nombre de commandes (enrichissement du 16/09/2026,
 * "courbe commandes" Business) : `format`/`totalLabel`/`ariaLabel`
 * paramètrent le libellé du total et son unité plutôt que de dupliquer tout
 * le composant pour changer "FCFA" en un simple nombre.
 */
export function RevenueTrendChart({
  points,
  format = (n) => `${FMT_FCFA.format(n)} FCFA`,
  totalLabel = "Total sur la période",
  ariaLabel = "Évolution du chiffre d'affaires",
}: {
  points: { label: string; value: number }[];
  format?: (n: number) => string;
  totalLabel?: string;
  ariaLabel?: string;
}) {
  const width = 600;
  const height = 160;
  const padding = 8;
  const max = Math.max(1, ...points.map((p) => p.value));

  const coords = points.map((p, i) => {
    const x =
      points.length > 1 ? padding + (i / (points.length - 1)) * (width - padding * 2) : width / 2;
    const y = height - padding - (p.value / max) * (height - padding * 2);
    return { x, y };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const areaPath =
    coords.length > 0
      ? `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${height - padding} L${coords[0].x.toFixed(1)},${height - padding} Z`
      : "";

  const total = points.reduce((sum, p) => sum + p.value, 0);

  if (points.every((p) => p.value === 0)) {
    return (
      <p className="text-sm text-encre/60">
        Aucune commande sur cette période pour l&apos;instant.
      </p>
    );
  }

  return (
    <div>
      <p className="text-xs text-encre/60">
        {totalLabel} : <span className="font-mono font-medium text-vert-actif">{format(total)}</span>
      </p>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 w-full" preserveAspectRatio="none" role="img" aria-label={ariaLabel}>
        {areaPath && <path d={areaPath} fill="var(--color-vert-actif, #1c6b4a)" fillOpacity={0.12} stroke="none" />}
        {linePath && <path d={linePath} fill="none" stroke="var(--color-vert-actif, #1c6b4a)" strokeWidth={2} />}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-encre/50">
        <span>{points[0]?.label}</span>
        {points.length > 2 && <span>{points[Math.floor(points.length / 2)]?.label}</span>}
        <span>{points[points.length - 1]?.label}</span>
      </div>
    </div>
  );
}

/** Répartition des commandes par statut — barres horizontales proportionnelles au max. */
export function StatusBreakdown({
  rows,
}: {
  rows: { label: string; count: number; badgeClass: string }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  if (total === 0) {
    return <p className="text-sm text-encre/60">Aucune commande pour l&apos;instant.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.label} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 text-encre/70">{row.label}</span>
          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-brume">
            <span
              className={`block h-full rounded-full ${row.badgeClass}`}
              style={{ width: `${Math.max(4, (row.count / max) * 100)}%` }}
            />
          </span>
          <span className="w-8 shrink-0 text-right font-mono text-encre/70">{row.count}</span>
        </li>
      ))}
    </ul>
  );
}

/** Classement simple (produits les plus vendus / les plus vus). */
export function RankedList({
  items,
  emptyLabel,
}: {
  items: { label: string; value: string }[];
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-encre/60">{emptyLabel}</p>;
  }

  return (
    <ol className="flex flex-col gap-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-center justify-between gap-3 text-sm">
          <span className="flex min-w-0 items-center gap-2 text-encre">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brume text-[11px] font-medium text-vert-actif">
              {i + 1}
            </span>
            <span className="truncate">{item.label}</span>
          </span>
          <span className="shrink-0 font-mono text-xs text-encre/60">{item.value}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Tuile chiffre simple (enrichissement du 16/09/2026) — pour les stats qui
 * n'ont pas de comparaison de période ni de classement : panier moyen,
 * valeur du stock, note moyenne, taux d'annulation, compteurs clients...
 */
export function StatTile({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <div className="rounded-lg border border-ligne bg-white p-4">
      <p className="text-xs text-encre/60">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold text-encre">{value}</p>
      {sublabel && <p className="mt-0.5 text-xs text-encre/50">{sublabel}</p>}
    </div>
  );
}

/**
 * Barres horizontales proportionnelles au montant — répartition du CA par
 * catégorie ou par moyen de paiement (enrichissement du 16/09/2026, plan
 * Business). Même construction visuelle que `StatusBreakdown`, généralisée
 * pour un montant en FCFA plutôt qu'un simple compte, avec une couleur fixe
 * (vert-actif, cohérent avec la courbe de CA) puisqu'il n'y a pas de statut
 * sémantique à distinguer ici.
 */
export function RevenueBars({
  rows,
  emptyLabel,
}: {
  rows: { label: string; revenue: number; sublabel?: string }[];
  emptyLabel: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.revenue));

  if (rows.length === 0) {
    return <p className="text-sm text-encre/60">{emptyLabel}</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.label} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 truncate text-encre/70">{row.label}</span>
          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-brume">
            <span
              className="block h-full rounded-full bg-vert-actif"
              style={{ width: `${Math.max(4, (row.revenue / max) * 100)}%` }}
            />
          </span>
          <span className="w-28 shrink-0 text-right font-mono text-xs text-encre/70">
            {FMT_FCFA.format(row.revenue)} FCFA
            {row.sublabel && <span className="block text-encre/45">{row.sublabel}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Barres de répartition par COMPTE brut (pas un montant FCFA) — ajouté le
 * 22/09/2026 pour "Trafic par source" (voir migration 0043). Même dessin que
 * `RevenueBars` ci-dessus (barre proportionnelle au max + valeur alignée à
 * droite), mais sans le formatage FCFA : un composant distinct plutôt que de
 * complexifier `RevenueBars` avec un format conditionnel pour ce seul usage.
 */
export function CountBars({
  rows,
  emptyLabel,
}: {
  rows: { label: string; count: number; sublabel?: string }[];
  emptyLabel: string;
}) {
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const max = Math.max(1, ...rows.map((r) => r.count));

  if (rows.length === 0 || total === 0) {
    return <p className="text-sm text-encre/60">{emptyLabel}</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.label} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 truncate text-encre/70">{row.label}</span>
          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-brume">
            <span
              className="block h-full rounded-full bg-vert-actif"
              style={{ width: `${Math.max(4, (row.count / max) * 100)}%` }}
            />
          </span>
          <span className="w-24 shrink-0 text-right font-mono text-xs text-encre/70">
            {row.count} ({Math.round((row.count / total) * 100)}%)
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Tuile de comparaison de périodes (Pro) — variation en %, colorée selon le sens. */
export function ComparisonTile({
  label,
  current,
  previous,
  format,
}: {
  label: string;
  current: number;
  previous: number;
  format: (n: number) => string;
}) {
  const hasPrevious = previous > 0;
  const change = hasPrevious ? ((current - previous) / previous) * 100 : null;
  const colorClass =
    change === null
      ? "text-encre/50"
      : change > 0
        ? "text-succes"
        : change < 0
          ? "text-erreur"
          : "text-encre/50";

  return (
    <div className="rounded-lg border border-ligne bg-white p-4">
      <p className="text-xs text-encre/60">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold text-encre">{format(current)}</p>
      <p className={`mt-0.5 text-xs ${colorClass}`}>
        {change === null
          ? "Pas de données sur la période précédente"
          : `${change > 0 ? "+" : ""}${change.toFixed(0)}% vs période précédente`}
      </p>
    </div>
  );
}
