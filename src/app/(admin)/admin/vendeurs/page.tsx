import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { categoryLabel } from "@/lib/categories";
import { SearchIcon, StorefrontIcon } from "@/components/admin/admin-icons";
import { VendorRowActions } from "./vendor-row-actions";

const PAGE_SIZE = 50;

const SHOP_SELECT =
  "id, name, slug, logo_url, category, status, created_at, owner:profiles(display_name, phone), shop_admin_notes(note)";

// Échappe les caractères spéciaux ILIKE (% et _) pour qu'une recherche
// contenant l'un d'eux (ex: un nom de boutique avec un underscore) soit
// traitée littéralement plutôt que comme un joker.
function escapeIlike(value: string): string {
  return value.replace(/[%_]/g, (match) => `\\${match}`);
}

type ShopRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  category: string;
  status: string;
  created_at: string;
  owner: { display_name: string | null; phone: string | null } | { display_name: string | null; phone: string | null }[] | null;
  shop_admin_notes: { note: string | null } | { note: string | null }[] | null;
};

// Gestion des vendeurs (cahier des charges §3.1.C.2) : recherche, activation
// / suspension. La recherche porte sur le nom/slug de la boutique
// uniquement (pas le téléphone du vendeur) — même simplification que la
// recherche marketplace (titre produit seulement), voir decisions-techniques.md.
//
// Redessinée le 15/09/2026 avec la pastille logo/initiale déjà utilisée
// partout ailleurs pour représenter une boutique (`ShopCard`, `CategoryNav`)
// — même langage visuel, pas une nouvelle convention pour cette seule page.
export default async function AdminVendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const trimmedQuery = q?.trim() || undefined;
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  // Recherche corrigée le 22/09/2026 (audit pré-lancement) : la version
  // précédente interpolait `q` tel quel dans une chaîne de filtre
  // `.or("name.ilike.%…%,slug.ilike.%…%")` — PostgREST y traite la virgule
  // et les parenthèses comme des séparateurs de syntaxe, donc une recherche
  // contenant une virgule (ex: un nom de boutique suivi d'une ville) cassait
  // la requête. L'erreur PostgREST n'était jamais vérifiée (`shops` retombait
  // silencieusement à `null`/`undefined`), donc l'admin voyait juste "Aucune
  // boutique trouvée" sans savoir que la recherche avait échoué plutôt que de
  // vraiment ne rien trouver. Deux requêtes `.ilike()` séparées (méthode
  // paramétrée, jamais de construction de chaîne à la main) fusionnées par id
  // plutôt qu'un `.or()` à réparer — évite complètement la classe de
  // problème plutôt que de rajouter un échappement de virgule/parenthèse en
  // plus de celui déjà nécessaire pour `%`/`_`.
  let shops: ShopRow[] | null = null;
  let shopsCount: number | null = null;
  let fetchError: string | null = null;

  if (trimmedQuery) {
    const escaped = escapeIlike(trimmedQuery);
    const [byName, bySlug] = await Promise.all([
      supabase
        .from("shops")
        .select(SHOP_SELECT, { count: "exact" })
        .ilike("name", `%${escaped}%`)
        .order("created_at", { ascending: false })
        .range(from, to),
      supabase
        .from("shops")
        .select(SHOP_SELECT, { count: "exact" })
        .ilike("slug", `%${escaped}%`)
        .order("created_at", { ascending: false })
        .range(from, to),
    ]);

    if (byName.error || bySlug.error) {
      fetchError = byName.error?.message ?? bySlug.error?.message ?? "Erreur inconnue";
    } else {
      const merged = new Map<string, ShopRow>();
      for (const row of [...(byName.data ?? []), ...(bySlug.data ?? [])] as ShopRow[]) {
        merged.set(row.id, row);
      }
      shops = [...merged.values()].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      // Approximation : la vraie borne "total de résultats distincts" exigerait
      // une requête dédiée (UNION côté base) — le plus grand des deux comptes
      // suffit à afficher une pagination raisonnable pour ce volume admin.
      shopsCount = Math.max(byName.count ?? 0, bySlug.count ?? 0);
    }
  } else {
    const { data, count, error } = await supabase
      .from("shops")
      .select(SHOP_SELECT, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    shops = data as ShopRow[] | null;
    shopsCount = count;
    fetchError = error?.message ?? null;
  }

  const totalPages = shopsCount ? Math.ceil(shopsCount / PAGE_SIZE) : 1;

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-encre">Vendeurs</h1>

      <form method="GET" className="mt-4 flex gap-2">
        <div className="relative w-full max-w-sm">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-encre/40" />
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Rechercher une boutique (nom ou lien)..."
            className="w-full rounded-md border border-ligne py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-vert-actif"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-vert-actif px-4 py-2 text-sm font-medium text-ivoire hover:bg-vert-sapin"
        >
          Rechercher
        </button>
      </form>

      {fetchError && (
        <p className="mt-4 rounded-md border border-erreur/30 bg-erreur/5 px-3 py-2 text-sm text-erreur">
          Impossible de charger les boutiques pour l&apos;instant. Réessaie dans un instant.
        </p>
      )}

      {!fetchError && (shops ?? []).length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-lg border border-dashed border-ligne bg-white py-12 text-center">
          <StorefrontIcon className="h-8 w-8 text-encre/30" />
          <p className="text-sm text-encre/60">Aucune boutique trouvée.</p>
        </div>
      ) : fetchError ? null : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-ligne bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-ligne text-xs text-encre/50">
                <th className="py-3 pl-4 pr-4">Boutique</th>
                <th className="py-3 pr-4">Vendeur</th>
                <th className="py-3 pr-4">Catégorie</th>
                <th className="py-3 pr-4">Statut</th>
                <th className="py-3 pr-4">Créée le</th>
                <th className="py-3 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ligne">
              {(shops as ShopRow[]).map((shop) => {
                const owner = Array.isArray(shop.owner) ? shop.owner[0] : shop.owner;
                const notesRow = Array.isArray(shop.shop_admin_notes)
                  ? shop.shop_admin_notes[0]
                  : shop.shop_admin_notes;
                return (
                  <tr key={shop.id} className="align-top transition-colors hover:bg-brume/60">
                    <td className="py-3 pl-4 pr-4">
                      <div className="flex items-center gap-3">
                        {shop.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element -- image uploadée par le vendeur, source dynamique
                          <img
                            src={shop.logo_url}
                            alt={shop.name}
                            className="h-9 w-9 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brume text-sm font-semibold text-vert-actif">
                            {shop.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-encre">{shop.name}</p>
                          <p className="text-xs text-encre/50">/{shop.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-encre/70">
                      <p>{owner?.display_name ?? "—"}</p>
                      <p className="text-xs text-encre/50">{owner?.phone ?? ""}</p>
                    </td>
                    <td className="py-3 pr-4 text-encre/70">{categoryLabel(shop.category)}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${
                          shop.status === "active"
                            ? "bg-succes/15 text-succes"
                            : "bg-erreur/15 text-erreur"
                        }`}
                      >
                        {shop.status === "active" ? "Active" : "Suspendue"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-encre/50">
                      {new Date(shop.created_at).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="py-3 pr-4">
                      <VendorRowActions
                        shopId={shop.id}
                        status={shop.status}
                        adminNotes={notesRow?.note ?? null}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination ajoutée le 22/09/2026 (audit pré-lancement) : cette page
          chargeait jusqu'ici la table `shops` entière, sans limite — même
          classe de problème identifiée le matin même pour les requêtes
          marketplace non plafonnées, ici plus critique encore puisque le
          nombre de boutiques croît directement avec le nombre de vendeurs
          (1000-2000 visés par Isaac). Même style que la pagination
          marketplace (`src/app/page.tsx`). */}
      {!fetchError && totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm">
          {page > 1 ? (
            <Link
              href={`/admin/vendeurs?${new URLSearchParams({ ...(trimmedQuery ? { q: trimmedQuery } : {}), page: String(page - 1) })}`}
              className="rounded-md border border-ligne px-3 py-1.5 text-encre transition hover:border-vert-actif"
            >
              ‹ Précédent
            </Link>
          ) : (
            <span className="rounded-md border border-ligne px-3 py-1.5 text-encre/30">‹ Précédent</span>
          )}
          <span className="px-2 font-mono text-encre/70">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={`/admin/vendeurs?${new URLSearchParams({ ...(trimmedQuery ? { q: trimmedQuery } : {}), page: String(page + 1) })}`}
              className="rounded-md border border-ligne px-3 py-1.5 text-encre transition hover:border-vert-actif"
            >
              Suivant ›
            </Link>
          ) : (
            <span className="rounded-md border border-ligne px-3 py-1.5 text-encre/30">Suivant ›</span>
          )}
        </div>
      )}
    </div>
  );
}
