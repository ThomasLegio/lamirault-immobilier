# Synchronisation Apps Script → GitHub → Vercel

Le tableau reste privé. Aucun compte de service Google ni secret GOOGLE_SERVICE_ACCOUNT_JSON n’est nécessaire.

## Installer

1. Dans le Google Sheets, ouvrir Extensions → Apps Script et copier `integrations/google-apps-script/Code.gs` dans Code.gs. Enregistrer.
2. Publier les changements du dépôt sur sa branche par défaut, dont `.github/workflows/sync-property-statuses.yml`. Le workflow doit être présent avant la première exécution Apps Script.
3. Créer un jeton GitHub **fine-grained**, limité au dépôt `ThomasLegio/lamirault-immobilier`, permission **Actions: Read and write**. Définir une expiration et prévoir son renouvellement. Il ne nécessite pas Contents: write ; le workflow utilise son propre GITHUB_TOKEN pour pousser.
4. Dans Apps Script → Paramètres du projet → Propriétés du script, enregistrer `GITHUB_TOKEN` avec ce jeton. Ne pas le coller dans le code ni dans la conversation. Seuls des utilisateurs de confiance doivent pouvoir modifier le script lié au tableau.
5. Si la branche par défaut n’est pas `main`, ajouter `GITHUB_BRANCH` avec son nom.
6. Sélectionner `installerSynchronisation`, cliquer Exécuter et autoriser les accès Google demandés après vérification. Ne pas cliquer Déployer : aucun déploiement Web App n’est requis.
7. Vérifier dans GitHub Actions le succès du workflow et dans Vercel la publication du commit. Le dépôt doit être connecté à Vercel et les commits du robot autorisés à déployer. Si la branche est protégée contre les écritures, adapter au circuit de PR.

Le script envoie uniquement l’identifiant du tableau, les références, les statuts et l’heure de capture. Il transmet immédiatement après modification des colonnes A ou G et toutes les 15 minutes pour reprendre les échecs. GitHub réceptionne les données, valide toutes les lignes, lance les tests et le build, puis enregistre les statuts et les pages générées. La confirmation Apps Script indique une transmission, pas une publication terminée.

## Comportement

- En vente : annonce visible avec étiquette.
- Sous compromis : annonce visible avec étiquette.
- Vendu : retiré du catalogue, fiche remplacée par une redirection HTML et un lien de secours vers `/biens/`, avec noindex.
- Ligne supprimée ou statut vide : dernier statut conservé.
- Référence inconnue/dupliquée, statut invalide ou en-tête modifié : synchronisation rejetée.
- Capture plus ancienne que la dernière appliquée : ignorée.
- Erreur d’accès, de validation ou de build : aucune nouvelle version poussée ; le site publié reste inchangé.

Les références sont les identifiants stables. Le tableau n’importe pas automatiquement de nouvelles annonces SeLoger et ses autres colonnes sont informatives. Les URL utilisent `https://lamirault.agence-legio.fr`.

## Vérifier

```sh
node --test scripts/property-statuses.test.mjs
npm run generate
npm run biens:check
npm run build
```

Une fois connecté, tester un changement réel de statut et vérifier Actions puis le site. Tester le retrait d’un bien vendu en prévisualisation. Le jeton GitHub et les autorisations Google ne sont pas encore configurés par le code seul.

Références :
- https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event
- https://developers.google.com/apps-script/guides/triggers/installable
