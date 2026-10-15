---
description: Déploie en production via le webhook Portainer (PORTAINER_PROD_WEBHOOK_URL dans .env)
allowed-tools: Bash(git rev-parse:*), Bash(git log:*), Bash(git status:*), Bash(git fetch:*), Bash(gh run:*), Bash(curl:*)
---

Déclenche un déploiement en **production** en appelant le webhook Portainer. La stack ne
construit plus rien : elle télécharge l'image `ghcr.io/powange/sot-reputations:main`, construite
et publiée par le workflow GitHub `publier-image.yml` à chaque push sur `main`. Tout doit donc
être poussé, **et l'image du dernier commit publiée**, avant d'appeler le webhook.

Exécute ces étapes dans l'ordre, et **arrête-toi** (sans déployer) si une vérification échoue :

1. **Branche** — `git rev-parse --abbrev-ref HEAD` doit valoir `main`. Sinon, signale-le et arrête.

2. **Commits non poussés** — `git log --oneline origin/main..HEAD`. Si la sortie n'est pas
   vide, il y a des commits locaux qui ne seront **pas** déployés : préviens l'utilisateur,
   liste-les, et demande s'il veut d'abord les pousser. Ne déclenche pas le webhook tant que
   ce n'est pas réglé.

3. **Image publiée** — l'image de `origin/main` doit être construite avant de déployer, sinon
   Portainer remettrait en ligne l'image précédente. Récupère le commit et son run :

   ```bash
   git fetch -q origin main && sha="$(git rev-parse origin/main)" && gh run list --workflow=publier-image.yml --commit "$sha" --limit 1 --json databaseId,status,conclusion
   ```

   - Liste vide : le run vient d'être déclenché par le push et n'est pas encore visible —
     réessaie quelques secondes plus tard (jusqu'à ~1 min) avant de conclure qu'il manque.
   - `status` différent de `completed` : attends la fin avec `gh run watch <databaseId> --exit-status`
     (le build prend quelques minutes).
   - `conclusion` différente de `success` : **n'appelle pas le webhook**. Montre l'erreur
     (`gh run view <databaseId> --log-failed | tail -40`) et arrête.

4. **Déclenche le webhook** — exécute exactement (en une seule commande Bash, pour que l'URL
   secrète ne soit jamais affichée) :

   ```bash
   url="$(grep -m1 '^PORTAINER_PROD_WEBHOOK_URL=' .env | cut -d= -f2-)"; url="${url%\"}"; url="${url#\"}"; curl -sS -X POST -o /dev/null -w "%{http_code}\n" "$url"
   ```

   - **Ne jamais** afficher la valeur de `$url` (c'est un secret). `-o /dev/null` masque la réponse.
   - Portainer renvoie **204** (ou 200) en cas de succès.

5. **Rapporte** — code HTTP **2xx** = déploiement déclenché ✅ (Portainer télécharge l'image
   publiée et redémarre le conteneur, une à deux minutes). Tout autre code (ou erreur curl) = échec : indique le
   code et suggère de vérifier que `PORTAINER_PROD_WEBHOOK_URL` est correct dans `.env`.
