/**
 * Sérialise un objet JSON-LD pour l'injecter dans
 * `<script type="application/ld+json" dangerouslySetInnerHTML={...}>`.
 *
 * Ajouté le 09/10/2026 (audit de sécurité) : `JSON.stringify` seul n'échappe
 * pas `<`, donc une valeur saisie par un vendeur (nom ou description de
 * boutique) contenant `</script><script>…` fermait la balise et exécutait du
 * JavaScript chez chaque visiteur — XSS stockée, que la CSP ne bloque pas
 * (`'unsafe-inline'`, voir next.config.ts).
 *
 * `<`, `>` et `&` sont remplacés par leur échappement Unicode JSON : le JSON
 * reste strictement identique une fois relu (moteurs de recherche), mais le
 * navigateur ne peut plus y voir de balise.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
