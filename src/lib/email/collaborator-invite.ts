import { sendTransactionalEmail } from "./brevo";

/**
 * Email à la personne invitée comme collaborateur d'une boutique (plan Pro,
 * `can_multi_user`, ajouté le 16/09/2026 — voir
 * supabase/migrations/0024_shop_collaborators.sql). Volontairement pas de
 * lien à jeton unique : l'acceptation (`accept_shop_collaboration`, RPC
 * security definer) matche sur l'email du compte connecté au moment
 * d'accepter, donc l'invité doit simplement se connecter (ou créer un
 * compte) avec CETTE adresse email précise — le lien pointe vers la
 * connexion, la page /dashboard/boutique affiche ensuite l'invitation en
 * attente si l'email correspond (voir boutique/page.tsx).
 *
 * Best-effort comme tous les autres emails du projet : un échec d'envoi ne
 * bloque jamais la création de l'invitation elle-même (la ligne existe déjà
 * en base, visible manuellement par le propriétaire dans la liste).
 */
export async function sendCollaboratorInviteEmail({
  email,
  shopName,
}: {
  email: string;
  shopName: string;
}): Promise<void> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  await sendTransactionalEmail({
    to: email,
    subject: `${shopName} t'invite à rejoindre son équipe sur KEVA`,
    html: `
      <p>Bonjour,</p>
      <p><strong>${shopName}</strong> t'invite à gérer sa boutique avec elle/lui sur KEVA (produits et commandes).</p>
      <p>Connecte-toi (ou crée un compte) avec cette adresse email (${email}) pour voir et accepter l'invitation :</p>
      <p><a href="${siteUrl}/connexion">${siteUrl}/connexion</a></p>
      <p style="color:#888;font-size:12px;">Boutique : ${shopName}</p>
    `,
  });
}
