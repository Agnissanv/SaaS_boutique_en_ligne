/**
 * Chemin interne sûr pour un paramètre `?suite=` (retour après connexion ou
 * inscription, ex. vers une invitation partenaire). N'accepte qu'un chemin
 * de CE site : commence par un seul « / », sans « // » ni « \ » qui
 * permettraient de sortir vers un autre domaine (redirection ouverte, même
 * précaution que `toSameOriginPath` dans auth/callback/route.ts).
 */
export function safeInternalPath(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return null;
  return raw;
}
