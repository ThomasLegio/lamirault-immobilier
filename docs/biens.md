# Catalogue des biens

Le catalogue est disponible sur `/biens/`. Le CTA « Nos biens » du header et le lien du footer ouvrent cette page. Les 21 annonces de l’agence ont été vérifiées sur SeLoger le 22 octobre 2026, sur les sept pages de son profil public.

## Une seule mise en page

- `data/biens/*.json` : un fichier par annonce, identifié par son identifiant SeLoger.
- `scripts/properties.mjs` : modèle commun des fiches et du catalogue.
- `shared/property.css` et `shared/property.js` : présentation et galerie photo.
- `shared/catalogue.css` et `shared/catalogue.js` : présentation et filtres du catalogue.
- `shared/header.html`, `shared/footer.html` et `shared/shell.css` : composants communs à toutes les pages, y compris la page 404.
- `data/seloger-inventory.json` : inventaire des liens effectivement consultés. Il permet de contrôler qu’aucun bien n’a été oublié.

Ne pas modifier directement les fichiers `biens/**/index.html` : ils sont générés. Le lien existant `/biens/maison-saint-benoit-43/` est conservé.

## Importer ou actualiser des annonces

1. Récupérer les pages publiques des annonces via le navigateur. Dans Safari : **Fichier → Enregistrer sous → Source de la page**. Dans Chrome : enregistrer la page HTML. Les enregistrements bruts restent dans un dossier temporaire, hors du site et hors de Git.
2. Si la source ne contient pas d’URL canonique, placer à côté du HTML un fichier portant le même nom avec l’extension `.url`, contenant uniquement le lien SeLoger de l’annonce. Les annonces déjà importées et les liens de l’inventaire sont reconnus automatiquement.
3. Lancer :

   ```sh
   npm run biens:import -- /chemin/vers/les-pages
   npm run generate
   npm run biens:check
   npm run build
   ```

Un fichier HTML unique ou plusieurs fichiers sont également acceptés. Le téléchargement des photos nécessite un accès réseau. Les photos inchangées sont réutilisées. Les fichiers JSON restent inchangés si leur contenu n’a pas évolué. Le script vérifie l’agence, le statut, le type de transaction et les informations essentielles ; une erreur est signalée sans supprimer les biens existants.

Pour une vérification supplémentaire contre les fichiers source :

```sh
npm run biens:check -- --source-dir /chemin/vers/les-pages
```

Le site est entièrement statique : aucune API d’IA, aucune génération d’image et aucun crédit IA ne sont nécessaires pour importer des fichiers, générer les pages ou consulter le catalogue. La commande d’import ne pilote pas le navigateur : l’acquisition des pages est une étape distincte. Elle peut être effectuée par l’assistant ; l’utilisateur n’a pas besoin de coder les fiches.

## Retirer un bien ou corriger une fiche

Après vérification de son retrait, passer `status` de `active` à `archived` dans le JSON puis relancer `npm run generate` et `npm run build`. Le bien disparaît du catalogue ; son ancienne URL reste disponible avec un message d’archive et `noindex`. Un import partiel ou un échec SeLoger ne retire jamais automatiquement une annonce. Le statut archivé est conservé lors d’un nouvel import ; le réactiver explicitement si le bien est remis en vente.

Les champs du JSON peuvent être corrigés directement. Une nouvelle importation actualise les champs provenant de SeLoger. Le `slug` est conservé pour stabiliser les liens. Les descriptions, prix, honoraires et diagnostics sont repris de la source sans réécriture ; d’éventuelles incohérences de l’annonce doivent être corrigées à la source.

## Automatisation durable

La création des pages est automatisée. La synchronisation SeLoger n’est pas planifiée et n’est pas garantie : l’accès direct aux annonces a renvoyé une protection anti-robot, tandis que la consultation normale dans Safari fonctionnait. Pour supprimer la capture des pages à chaque mise à jour, raccorder un export autorisé du logiciel immobilier de l’agence (JSON/CSV/XML ou flux disponible) à ce même schéma de données. Aucun abonnement ni service externe n’a été activé.
