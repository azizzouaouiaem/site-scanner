# Accessibility Reviewer

Scanne une page web pour l'accessibilité (WCAG 2.x, via [axe-core](https://github.com/dequelabs/axe-core)) et envoie un rapport détaillé par courriel (EN/FR). Conçu pour être déployé sur [Vercel](https://vercel.com).

Flow : `URL -> navigateur headless (Playwright + Chromium) -> axe-core -> scoring déterministe -> courriel (Resend) + enregistrement en base (Postgres)`.

Aucun LLM n'est nécessaire à l'exécution : les recommandations viennent directement des règles axe-core, et les estimations de temps (développeur manuel vs automatisé) sont calculées par une formule déterministe (voir `src/lib/scoring.ts`).

## Pourquoi un navigateur headless plutôt qu'un simple `fetch` ?

Beaucoup de sites sont protégés par un WAF/anti-bot qui bloque les requêtes HTTP "nues". Le scanner lance un vrai Chromium (via `playwright-core` + `@sparticuz/chromium`, qui fournit un binaire Chromium compatible avec l'environnement serverless de Vercel) avec un user-agent et des en-têtes réalistes, ce qui est beaucoup moins souvent bloqué qu'un `fetch` côté serveur. `axe-core` est ensuite injecté et exécuté directement dans la page rendue (nécessaire pour des règles comme le contraste de couleur, qui exigent un vrai rendu).

## Contraintes importantes sur le plan Vercel Hobby (gratuit)

- Les fonctions Node.js peuvent être configurées jusqu'à `maxDuration = 60` (déjà fait dans `src/app/api/scan/route.ts`), mais un cold start de Chromium + chargement de page + axe peut occasionnellement dépasser cette limite sur des pages lourdes. Si tu vois des erreurs `scan_timeout` fréquentes, passe au plan Pro (jusqu'à 300s).
- La taille du bundle de fonction (~50-70 Mo avec Chromium) reste sous la limite Hobby, mais évite d'ajouter d'autres grosses dépendances serveur.

## Setup

```bash
cd tools/accessibility-reviewer
npm install
npx playwright install chromium   # nécessaire uniquement pour le dev local (npm run dev)
cp .env.example .env.local          # puis remplir les variables
npm run dev
```

### Variables d'environnement

| Variable | Description |
| --- | --- |
| `RESEND_API_KEY` | Clé API [Resend](https://resend.com/api-keys) |
| `RESEND_FROM_EMAIL` | Expéditeur vérifié dans Resend, ex. `Accessibility Reviewer <reports@tondomaine.com>` |
| `POSTGRES_URL` | Connection string Postgres. Sur Vercel : ajoute l'intégration **Storage → Postgres** (Neon) depuis le dashboard, elle configure cette variable automatiquement. |
| `CONTACT_EMAIL` / `CONTACT_URL` | Utilisés dans le CTA "Contactez-nous" du rapport |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Même adresse, exposée côté client pour le bouton mailto de l'écran de résultat |

Aucune clé de LLM n'est requise.

### Base de données

Le schéma (table `scans`) est créé automatiquement au premier appel (`CREATE TABLE IF NOT EXISTS` dans `src/lib/db.ts`) — pas de migration manuelle nécessaire. Chaque scan enregistre : courriel, URL finale, langue, score, nombre de problèmes, temps estimés, IP (pour le rate-limiting), date.

Pour consulter la liste collectée :

```sql
SELECT email, url, language, score, created_at FROM scans ORDER BY created_at DESC;
```

## Déploiement sur Vercel

1. Pousse ce dossier comme un projet Vercel (Root Directory = `tools/accessibility-reviewer` si tu déploies depuis ce monorepo).
2. Ajoute l'intégration **Postgres** (Storage tab) — elle injecte `POSTGRES_URL` automatiquement.
3. Ajoute les variables d'environnement `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CONTACT_EMAIL`, `CONTACT_URL`, `NEXT_PUBLIC_CONTACT_EMAIL`.
4. Déploie. `@sparticuz/chromium` est automatiquement utilisé en production (détecté via `process.env.VERCEL`).

## Sécurité

- **Anti-SSRF** (`src/lib/ssrf-guard.ts`) : l'URL soumise est résolue en DNS et toute IP privée/loopback/link-local (incl. `169.254.169.254`, métadonnées cloud) est rejetée avant tout scan.
- **Rate limiting** basique par courriel (5/heure) et par IP (10/15 min) pour limiter l'abus (spam d'un courriel tiers, DoS). Pour une utilisation publique à plus grande échelle, ajoute une vérification de courriel (lien magique) avant l'envoi du premier rapport.
- Le rendu email échappe le HTML injecté (titre de règle, URL) pour éviter toute injection dans le template.

## Limites connues / améliorations futures

- Le score 0-100 est une heuristique de lisibilité, pas une métrique WCAG officielle.
- Les estimations de temps (`src/lib/scoring.ts`) sont des heuristiques transparentes et modifiables, pas une mesure précise par projet.
- Pas de vérification que l'adresse courriel saisie appartient bien à l'utilisateur (voir section Sécurité).
- Pas de page d'administration pour consulter la liste des scans ; utilise directement des requêtes SQL (voir plus haut) ou branche un outil BI sur la base Postgres.
