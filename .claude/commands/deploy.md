---
description: Déploie en production via le webhook Portainer (PORTAINER_PROD_WEBHOOK_URL dans .env)
allowed-tools: Bash(git rev-parse:*), Bash(git log:*), Bash(git status:*), Bash(curl:*)
---

Déclenche un déploiement en **production** en appelant le webhook Portainer. Portainer
redéploie l'état de `origin/main`, donc tout doit être poussé avant.

Exécute ces étapes dans l'ordre, et **arrête-toi** (sans déployer) si une vérification échoue :

1. **Branche** — `git rev-parse --abbrev-ref HEAD` doit valoir `main`. Sinon, signale-le et arrête.

2. **Commits non poussés** — `git log --oneline origin/main..HEAD`. Si la sortie n'est pas
   vide, il y a des commits locaux qui ne seront **pas** déployés : préviens l'utilisateur,
   liste-les, et demande s'il veut d'abord les pousser. Ne déclenche pas le webhook tant que
   ce n'est pas réglé.

3. **Déclenche le webhook** — exécute exactement (en une seule commande Bash, pour que l'URL
   secrète ne soit jamais affichée) :

   ```bash
   url="$(grep -m1 '^PORTAINER_PROD_WEBHOOK_URL=' .env | cut -d= -f2-)"; url="${url%\"}"; url="${url#\"}"; curl -sS -X POST -o /dev/null -w "%{http_code}\n" "$url"
   ```

   - **Ne jamais** afficher la valeur de `$url` (c'est un secret). `-o /dev/null` masque la réponse.
   - Portainer renvoie **204** (ou 200) en cas de succès.

4. **Rapporte** — code HTTP **2xx** = déploiement déclenché ✅ (l'image se reconstruit côté
   Portainer, ça prend quelques minutes). Tout autre code (ou erreur curl) = échec : indique le
   code et suggère de vérifier que `PORTAINER_PROD_WEBHOOK_URL` est correct dans `.env`.
