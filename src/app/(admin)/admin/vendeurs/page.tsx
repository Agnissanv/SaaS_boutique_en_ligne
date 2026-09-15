import { createClient } from "@/lib/supabase/server";
import { categoryLabel } from "@/lib/categories";
import { VendorRowActions } from "./vendor-row-actions";

type ShopRow = {
  id: string;
  name: string;
  slug: string;
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
export default async function AdminVendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("shops")
    .select(
      "id, name, slug, category, status, created_at, owner:profiles(display_name, phone), shop_admin_notes(note)"
    )
    .order("created_at", { ascending: false });

  if (q) query = query.or(`name.ilike.%${q}%,slug.ilike.%${q}%`);

  const { data: shops } = await query;

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-encre">Vendeurs</h1>

      <form method="GET" className="mt-4 flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Rechercher une boutique (nom ou lien)..."
          className="w-full max-w-sm rounded-md border border-ligne px-3 py-2 text-sm focus:ring-2 focus:ring-vert-actif"
        />
        <button
          type="submit"
          className="rounded-md bg-cuivre-profond px-4 py-2 text-sm font-medium text-ivoire hover:bg-cuivre"
        >
          Rechercher
        </button>
      </form>

      {(shops ?? []).length === 0 ? (
        <p className="mt-6 text-sm text-encre/60">Aucune boutique trouvée.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-ligne text-xs text-encre/50">
                <th className="py-2 pr-4">Boutique</th>
                <th className="py-2 pr-4">Vendeur</th>
                <th className="py-2 pr-4">Catégorie</th>
                <th className="py-2 pr-4">Statut</th>
                <th className="py-2 pr-4">Créée le</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ligne">
              {(shops as ShopRow[]).map((shop) => {
                const owner = Array.isArray(shop.owner) ? shop.owner[0] : shop.owner;
                const notesRow = Array.isArray(shop.shop_admin_notes)
                  ? shop.shop_admin_notes[0]
                  : shop.shop_admin_notes;
                return (
                  <tr key={shop.id} className="align-top">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-encre">{shop.name}</p>
                      <p className="text-xs text-encre/50">/{shop.slug}</p>
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
    </div>
  );
}
