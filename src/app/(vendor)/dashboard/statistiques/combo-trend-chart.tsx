"use client";

import { useState } from "react";

/**
 * Courbe CA + barres vues, avec infobulle au survol — ajouté le 30/09/2026
 * (refonte Statistiques v2, inspiration maquette "Analytiques"), en
 * remplacement des deux cartes séparées "Chiffre d'affaires" et "Nombre de
 * commandes" (`RevenueTrendChart` x2) qui existaient jusqu'ici.
 *
 * Fichier séparé, `"use client"` volontairement PAS ajouté à `charts.tsx` :
 * `charts.tsx` est un fichier sans directive, dont les exports (dont
 * `RevenueTrendChart`) sont appelés depuis `statistiques/page.tsx` (Server
 * Component) avec une prop fonction (`format={(n) => ...}`) — passer une
 * fonction d'un Server Component à un Client Component est interdit en RSC
 * (non sérialisable). Ajouter `"use client"` à `charts.tsx` casserait donc
 * cet appel existant. Ce composant a besoin de `useState` pour l'infobulle
 * au survol, donc il vit dans son propre fichier client plutôt que d'y
 * exposer toute une nouvelle contrainte à `charts.tsx`.
 *
 * Deux échelles indépendantes (CA à gauche implicite, vues à droite
 * implicite) : les barres de vues sont normalisées sur leur propre maximum,
 * la courbe de CA sur le sien, pour que les deux restent lisibles même si
 * l'un des deux est beaucoup plus petit que l'autre (ex : 300 vues vs
 * 180 000 FCFA).
 */
export function ComboTrendChart({
  points,
}: {
  points: { label: string; revenue: number; views: number }[];
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const width = 600;
  const height = 180;
  const padding = 10;
  const barAreaHeight = 36;
  const lineAreaHeight = height - barAreaHeight - padding * 2;

  const maxRevenue = Math.max(1, ...points.map((p) => p.revenue));
  const maxViews = Math.max(1, ...points.map((p) => p.views));
  const totalRevenue = points.reduce((sum, p) => sum + p.revenue, 0);
  const totalViews = points.reduce((sum, p) => sum + p.views, 0);
  const fmtFcfa = new Intl.NumberFormat("fr-FR");

  if (points.every((p) => p.revenue === 0 && p.views === 0)) {
    return <p className="text-sm text-encre/60">Aucune donnée sur cette période pour l&apos;instant.</p>;
  }

  const barWidth = points.length > 0 ? (width - padding * 2) / points.length : 0;

  const coords = points.map((p, i) => {
    const x = points.length > 1 ? padding + (i / (points.length - 1)) * (width - padding * 2) : width / 2;
    const y = padding + lineAreaHeight - (p.revenue / maxRevenue) * lineAreaHeight;
    return { x, y };
  });
  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-xs text-encre/60">
        <p>
          CA : <span className="font-mono font-medium text-vert-actif">{fmtFcfa.format(totalRevenue)} FCFA</span>
        </p>
        <p>
          Vues : <span className="font-mono font-medium text-encre/70">{fmtFcfa.format(totalViews)}</span>
        </p>
      </div>

      <div className="relative mt-2">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          preserveAspectRatio="none"
          role="img"
          aria-label="Évolution du chiffre d'affaires et des vues"
          onMouseLeave={() => setHoverIndex(null)}
        >
          {points.map((p, i) => {
            const barHeight = (p.views / maxViews) * barAreaHeight;
            const x = padding + i * barWidth;
            return (
              <rect
                key={`bar-${i}`}
                x={x + barWidth * 0.2}
                y={height - padding - barHeight}
                width={barWidth * 0.6}
                height={barHeight}
                fill="var(--color-brume, #f7f5f1)"
                stroke="var(--color-ligne, #ddd6c9)"
              />
            );
          })}

          <path d={linePath} fill="none" stroke="var(--color-vert-actif, #1c6b4a)" strokeWidth={2} />

          {coords.map((c, i) => (
            <circle
              key={`pt-${i}`}
              cx={c.x}
              cy={c.y}
              r={hoverIndex === i ? 4 : 2.5}
              fill="var(--color-vert-actif, #1c6b4a)"
            />
          ))}

          {points.map((_, i) => (
            <rect
              key={`hit-${i}`}
              x={padding + i * barWidth}
              y={0}
              width={barWidth}
              height={height}
              fill="transparent"
              onMouseEnter={() => setHoverIndex(i)}
            />
          ))}

          {hoverIndex !== null && (
            <line
              x1={coords[hoverIndex].x}
              x2={coords[hoverIndex].x}
              y1={padding}
              y2={height - padding}
              stroke="var(--color-ligne, #ddd6c9)"
              strokeDasharray="3 3"
            />
          )}
        </svg>

        {hovered && hoverIndex !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-ligne bg-white px-2.5 py-1.5 text-xs shadow-sm"
            style={{
              left: `${(coords[hoverIndex].x / width) * 100}%`,
            }}
          >
            <p className="font-medium text-encre">{hovered.label}</p>
            <p className="text-vert-actif">{fmtFcfa.format(hovered.revenue)} FCFA</p>
            <p className="text-encre/60">{fmtFcfa.format(hovered.views)} vue(s)</p>
          </div>
        )}
      </div>

      <div className="mt-1 flex justify-between text-[11px] text-encre/50">
        <span>{points[0]?.label}</span>
        {points.length > 2 && <span>{points[Math.floor(points.length / 2)]?.label}</span>}
        <span>{points[points.length - 1]?.label}</span>
      </div>
    </div>
  );
}
