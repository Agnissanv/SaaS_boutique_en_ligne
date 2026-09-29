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
 * Mini-courbe (sparkline) sans axes ni graduations — ajoutée le 30/09/2026
 * (refonte de Statistiques v2, inspiration maquette "Analytiques") pour les
 * tuiles KPI. `stroke="currentColor"` : hérite la couleur texte posée par le
 * conteneur (voir `StatTile`/`ComparisonTile` ci-dessous) plutôt que de
 * prendre une couleur en dur, pour rester réutilisable. Retourne `null`
 * plutôt qu'un tracé plat quand il n'y a pas assez de points ou que toutes
 * les valeurs sont identiques (une ligne plate n'apporte aucune information
 * et serait trompeuse en zoom).
 */
export function Sparkline({
  points,
  className,
}: {
  points: number[];
  className?: string;
}) {
  if (points.length < 2 || points.every((v) => v === points[0])) return null;

  const width = 64;
  const height = 24;
  const max = Math.max(1, ...points);
  const min = Math.min(0, ...points);
  const range = max - min || 1;

  const coords = points.map((v, i) => {
    const x = points.length > 1 ? (i / (points.length - 1)) * width : width / 2;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className ?? "h-6 w-16"}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Tuile chiffre simple (enrichissement du 16/09/2026) — pour les stats qui
 * n'ont pas de comparaison de période ni de classement : panier moyen,
 * valeur du stock, note moyenne, taux d'annulation, compteurs clients...
 */
/**
 * `icon` optionnel ajouté le 29/09/2026 (refonte de l'Aperçu dashboard,
 * inspiration d'une maquette envoyée par Isaac) — une puce circulaire
 * `bg-brume`/`text-vert-actif`, même traitement que les icônes de
 * l'argumentaire de confiance sur la page d'accueil publique (`TRUST_ITEMS`,
 * `src/app/page.tsx`), plutôt qu'une icône par couleur différente par tuile
 * comme sur la maquette de référence — jugé trop proche du look "dashboard
 * IA générique" qu'Isaac a justement fait corriger ailleurs sur le site
 * (voir affiches-et-posts-lancement.md, palette cuivre/ivoire abandonnée
 * pour la même raison). Branché en deux rendus distincts (pas une classe
 * conditionnelle) pour ne rien changer au DOM des appels existants
 * (`/dashboard/statistiques`) qui ne passent pas d'icône.
 *
 * `trend` optionnel ajouté le 30/09/2026 (refonte Statistiques v2) — une
 * mini-courbe alignée à droite, seulement dans la branche "avec icône" (une
 * tuile sans icône n'a pas la largeur prévue pour ça). `undefined`/tableau
 * trop court : `Sparkline` retourne `null`, la tuile garde son rendu actuel.
 */
export function StatTile({
  label,
  value,
  sublabel,
  icon,
  trend,
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon?: React.ReactNode;
  trend?: number[];
}) {
  return (
    <div className="rounded-lg border border-ligne bg-white p-4">
      {icon ? (
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brume text-vert-actif">
              {icon}
            </span>
            <div className="min-w-0">
              <p className="text-xs text-encre/60">{label}</p>
              <p className="mt-1 font-mono text-lg font-semibold text-encre">{value}</p>
              {sublabel && <p className="mt-0.5 text-xs text-encre/50">{sublabel}</p>}
            </div>
          </div>
          {trend && <Sparkline points={trend} className="mt-1 h-8 w-14 shrink-0 text-vert-actif/45" />}
        </div>
      ) : (
        <>
          <p className="text-xs text-encre/60">{label}</p>
          <p className="mt-1 font-mono text-lg font-semibold text-encre">{value}</p>
          {sublabel && <p className="mt-0.5 text-xs text-encre/50">{sublabel}</p>}
        </>
      )}
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
/**
 * `icon` optionnel — même raisonnement que `StatTile` ci-dessus. `trend`
 * optionnel ajouté le 30/09/2026 (refonte Statistiques v2) — même
 * composant `Sparkline`, mêmes conditions d'affichage que `StatTile`.
 */
export function ComparisonTile({
  label,
  current,
  previous,
  format,
  icon,
  trend,
}: {
  label: string;
  current: number;
  previous: number;
  format: (n: number) => string;
  icon?: React.ReactNode;
  trend?: number[];
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
  const changeLabel = (
    <p className={`mt-0.5 text-xs ${colorClass}`}>
      {change === null
        ? "Pas de données sur la période précédente"
        : `${change > 0 ? "+" : ""}${change.toFixed(0)}% vs période précédente`}
    </p>
  );

  return (
    <div className="rounded-lg border border-ligne bg-white p-4">
      {icon ? (
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brume text-vert-actif">
              {icon}
            </span>
            <div className="min-w-0">
              <p className="text-xs text-encre/60">{label}</p>
              <p className="mt-1 font-mono text-lg font-semibold text-encre">{format(current)}</p>
              {changeLabel}
            </div>
          </div>
          {trend && <Sparkline points={trend} className="mt-1 h-8 w-14 shrink-0 text-vert-actif/45" />}
        </div>
      ) : (
        <>
          <p className="text-xs text-encre/60">{label}</p>
          <p className="mt-1 font-mono text-lg font-semibold text-encre">{format(current)}</p>
          {changeLabel}
        </>
      )}
    </div>
  );
}

/**
 * Donut CA par catégorie — ajouté le 30/09/2026 (refonte Statistiques v2,
 * inspiration maquette "Analytiques"). Anneau dessiné à la main via
 * `stroke-dasharray`/`stroke-dashoffset` sur un cercle SVG (pas de
 * librairie, même raisonnement que le reste de ce fichier). Monochrome
 * vert-actif à opacité décroissante par tranche plutôt qu'une couleur
 * différente par catégorie comme sur la maquette : même choix que les tuiles
 * KPI de l'Aperçu (voir `StatTile` ci-dessus) pour éviter le rendu
 * "dashboard IA générique". Catégories au-delà du top 5 regroupées sous
 * "Autres" plutôt que d'empiler des tranches trop fines pour être lisibles.
 * Les décalages cumulés (`dashOffsets`) sont calculés via une boucle à part,
 * pas un `.map()` qui muterait une variable pendant le rendu JSX.
 */
export function CategoryDonut({
  rows,
  emptyLabel,
}: {
  rows: { label: string; revenue: number }[];
  emptyLabel: string;
}) {
  const total = rows.reduce((sum, r) => sum + r.revenue, 0);

  if (rows.length === 0 || total <= 0) {
    return <p className="text-sm text-encre/60">{emptyLabel}</p>;
  }

  const sorted = [...rows].sort((a, b) => b.revenue - a.revenue);
  const top = sorted.slice(0, 5);
  const rest = sorted.slice(5);
  const restRevenue = rest.reduce((sum, r) => sum + r.revenue, 0);
  const slices = restRevenue > 0 ? [...top, { label: "Autres", revenue: restRevenue }] : top;

  const radius = 60;
  const circumference = 2 * Math.PI * radius;

  const withOffsets = slices.map((slice, i) => {
    const pct = slice.revenue / total;
    const length = pct * circumference;
    return {
      label: slice.label,
      pct,
      dash: `${length.toFixed(1)} ${(circumference - length).toFixed(1)}`,
      opacity: 1 - i * 0.15,
    };
  });

  let acc = 0;
  const dashOffsets: number[] = [];
  for (const s of withOffsets) {
    dashOffsets.push(-acc);
    acc += s.pct * circumference;
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <svg
        viewBox="0 0 160 160"
        className="h-36 w-36 shrink-0"
        role="img"
        aria-label="Répartition du chiffre d'affaires par catégorie"
      >
        <circle cx="80" cy="80" r={radius} fill="none" stroke="var(--color-brume, #f7f5f1)" strokeWidth="20" />
        {withOffsets.map((s, i) => (
          <circle
            key={s.label + i}
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="var(--color-vert-actif, #1c6b4a)"
            strokeOpacity={s.opacity}
            strokeWidth="20"
            strokeDasharray={s.dash}
            strokeDashoffset={dashOffsets[i]}
            transform="rotate(-90 80 80)"
          />
        ))}
        <text x="80" y="77" textAnchor="middle" className="fill-encre font-mono text-[15px] font-semibold">
          {FMT_FCFA.format(Math.round(total))}
        </text>
        <text x="80" y="93" textAnchor="middle" className="fill-encre text-[9px] opacity-50">
          FCFA total
        </text>
      </svg>
      <ul className="flex w-full min-w-0 flex-col gap-1.5">
        {withOffsets.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-vert-actif" style={{ opacity: s.opacity }} />
            <span className="min-w-0 flex-1 truncate text-encre/70">{s.label}</span>
            <span className="shrink-0 font-mono text-encre/60">{Math.round(s.pct * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
