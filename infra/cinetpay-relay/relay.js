// cinetpay-relay.js — relais IP fixe pour l'API CinetPay (Aurora).
//
// Pourquoi : CinetPay exige que l'IP appelante soit sur liste blanche
// ("This Ip is not withlisted"). Vercel n'assigne pas d'IP sortante fixe par
// défaut (fonctionnalité payante chez eux). Ce petit relais tourne sur une VM
// à IP fixe et gratuite (Google Cloud e2-micro ou Oracle Cloud, offre
// "Always Free") : KEVA (Vercel) appelle CE relais, qui relaie vers
// api.cinetpay.net. C'est l'IP FIXE de cette VM qu'il faut faire whitelister
// par CinetPay — pas une IP Vercel, qui change à chaque appel.
//
// Aucune dépendance npm — juste Node.js (modules "http"/"https" intégrés).
//
// Démarrage :
//   RELAY_SECRET="<longue-chaîne-aléatoire>" node relay.js
//
// La même valeur RELAY_SECRET doit être mise dans la variable d'environnement
// CINETPAY_RELAY_SECRET côté Vercel (projet KEVA) — c'est ce qui empêche
// n'importe qui découvrant l'URL du relais de s'en servir comme proxy anonyme
// vers CinetPay.
//
// Ce script écoute en clair (http) sur 127.0.0.1 uniquement — jamais exposé
// directement à internet. C'est Caddy (voir Caddyfile fourni à côté) qui
// reçoit le trafic public en HTTPS (certificat Let's Encrypt automatique et
// gratuit) et le relaie en local vers ce script. Sans ça, la clé/le mot de
// passe API CinetPay transiteraient en clair sur internet entre Vercel et la
// VM à chaque connexion — inacceptable pour des identifiants.

const http = require("http");
const https = require("https");

const PORT = process.env.PORT || 8080;
const HOST = "127.0.0.1"; // jamais 0.0.0.0 : seul Caddy (en local) doit pouvoir parler à ce process.
const SECRET = process.env.RELAY_SECRET;
const TARGET_HOST = "api.cinetpay.net";

if (!SECRET) {
  console.error("RELAY_SECRET manquant — arrêt. Démarrer avec RELAY_SECRET=... node relay.js");
  process.exit(1);
}

const server = http.createServer((req, res) => {
  if (req.headers["x-relay-secret"] !== SECRET) {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "forbidden" }));
    return;
  }

  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    const body = Buffer.concat(chunks);

    const upstreamHeaders = { "Content-Type": "application/json" };
    if (body.length > 0) upstreamHeaders["Content-Length"] = String(body.length);
    if (req.headers.authorization) upstreamHeaders["Authorization"] = req.headers.authorization;

    const upstreamReq = https.request(
      {
        hostname: TARGET_HOST,
        path: req.url, // même chemin que l'appel reçu (/v1/oauth/login, /v1/payment, /v1/payment/:id)
        method: req.method,
        headers: upstreamHeaders,
      },
      (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode || 502, {
          "Content-Type": upstreamRes.headers["content-type"] || "application/json",
        });
        upstreamRes.pipe(res);
      }
    );

    upstreamReq.on("error", (err) => {
      console.error("Relais CinetPay — erreur en amont:", err);
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "relay_upstream_failed" }));
    });

    if (body.length > 0) upstreamReq.write(body);
    upstreamReq.end();
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Relais CinetPay en écoute sur http://${HOST}:${PORT} (relaie vers https://${TARGET_HOST})`);
});
