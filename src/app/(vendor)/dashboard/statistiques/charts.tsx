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

/** Courbe de chiffre d'affaires — un point par jour, aire teintée sous la ligne. */
export function RevenueTrendChart({
  points,
}: {
  points: { label: string; value: number }[];
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
        Total sur la période : <span className="font-mono font-medium text-cuivre-profond">{FMT_FCFA.format(total)} FCFA</span>
      </p>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 w-full" preserveAspectRatio="none" role="img" aria-label="Évolution du chiffre d'affaires">
        {areaPath && <path d={areaPath} fill="var(--color-cuivre-profond, #8b4f2e)" fillOpacity={0.12} stroke="none" />}
        {linePath && <path d={linePath} fill="none" stroke="var(--color-cuivre-profond, #8b4f2e)" strokeWidth={2} />}
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
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sable text-[11px] font-medium text-cuivre-profond">
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
