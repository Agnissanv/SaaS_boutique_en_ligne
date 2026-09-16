import { sendTransactionalEmail } from "./brevo";

/**
 * Email au VENDEUR quand un produit vient de franchir son seuil d'alerte
 * vers le bas — ajouté le 16/09/2026, "alertes de stock avancées"
 * (`has_advanced_stock_alerts`, plan Pro). Complète la barre de santé visuelle
 * déjà gratuite pour tous (`stockHealth`, src/lib/products.ts) : celle-ci
 * exige que le vendeur consulte le dashboard, ce email prévient
 * proactivement, comme sendNewOrderVendorEmail pour les commandes.
 *
 * Un seul email par commande, listant tous les produits concernés (une
 * commande peut faire passer plusieurs produits sous leur seuil à la fois)
 * plutôt qu'un email par produit — même best-effort/silencieux que le reste
 * des emails du projet.
 */
export async function sendLowStockVendorEmail({
  notificationEmail,
  shopName,
  products,
}: {
  notificationEmail: string | null | undefined;
  shopName: string;
  products: { title: string; stock: number; threshold: number }[];
}): Promise<void> {
  if (!notificationEmail || products.length === 0) return;

  const itemsHtml = products
    .map(
      (p) =>
        `<li><strong>${p.title}</strong> — ${p.stock} restant(s) (seuil : ${p.threshold})</li>`
    )
    .join("");

  await sendTransactionalEmail({
    to: notificationEmail,
    subject: `${shopName} — Stock bas sur ${products.length > 1 ? "plusieurs produits" : "un produit"}`,
    html: `
      <p>Bonjour,</p>
      <p>${products.length > 1 ? "Ces produits viennent" : "Ce produit vient"} de passer sous son seuil d'alerte suite à une commande :</p>
      <ul>${itemsHtml}</ul>
      <p>Pense à réapprovisionner si besoin.</p>
      <p style="color:#888;font-size:12px;">Boutique : ${shopName}</p>
    `,
  });
}
