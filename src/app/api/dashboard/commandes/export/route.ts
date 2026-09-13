import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  paid: "Payée",
  preparing: "En préparation",
  delivered: "Livrée",
  cancelled: "Annulée",
};

const PAYMENT_LABELS: Record<string, string> = {
  cash_on_delivery: "Paiement à la livraison",
  mobile_money: "Mobile Money",
};

/** Échappe une valeur pour un champ CSV (RFC 4180) : entoure de guillemets si nécessaire. */
function csvField(value: string | number): string {
  const str = String(value);
  if (/[",\n;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Export CSV des commandes du vendeur connecté — créé le 15/09/2026, manque
 * identifié dans l'analyse comparative avec les grosses plateformes (Jumia,
 * etc.) qui proposent toutes un export pour la comptabilité. Route Handler
 * plutôt que Server Action : une Server Action ne peut pas renvoyer un
 * fichier à télécharger directement (elle renvoie des données sérialisées,
 * pas une réponse HTTP avec ses propres en-têtes).
 *
 * Point-virgule comme séparateur (pas la virgule) : Excel en français
 * (paramètres régionaux Côte d'Ivoire/France) n'ouvre proprement un CSV
 * virgule que si le séparateur système est configuré en anglais — le
 * point-virgule est l'attente par défaut et évite l'écueil classique
 * "tout dans une seule colonne" au premier ouvreur avec Excel.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { data: shop } = await supabase
    .from("shops")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!shop) {
    return NextResponse.json({ error: "Aucune boutique" }, { status: 404 });
  }

  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, customer_name, customer_phone, customer_email, delivery_address, status, payment_method, delivery_fee, total_amount, created_at"
    )
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false });

  const header = [
    "Date",
    "Client",
    "Téléphone",
    "Email",
    "Adresse de livraison",
    "Statut",
    "Mode de paiement",
    "Frais de livraison (FCFA)",
    "Total (FCFA)",
  ];

  const lines = [header.map(csvField).join(";")];

  for (const order of orders ?? []) {
    lines.push(
      [
        new Date(order.created_at).toLocaleString("fr-FR"),
        order.customer_name,
        order.customer_phone,
        order.customer_email ?? "",
        order.delivery_address ?? "",
        STATUS_LABELS[order.status] ?? order.status,
        PAYMENT_LABELS[order.payment_method] ?? order.payment_method,
        order.delivery_fee,
        order.total_amount,
      ]
        .map(csvField)
        .join(";")
    );
  }

  // BOM UTF-8 en tête : sans lui, Excel affiche les accents français
  // (é, è, à...) comme des caractères corrompus à l'ouverture d'un CSV UTF-8.
  const csv = "\uFEFF" + lines.join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="commandes-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
}
