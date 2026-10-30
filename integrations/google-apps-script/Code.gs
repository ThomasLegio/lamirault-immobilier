/** Synchronisation Lamirault : aucune clé dans ce fichier. */
const TABLEAU_ID = '1aYpGYOCeG_dhmMP2B6PWWjTOn7G68xo37tjG873v9kw';
const DEPOT = 'ThomasLegio/lamirault-immobilier';
const WORKFLOW = 'sync-property-statuses.yml';

function installerSynchronisation() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('GITHUB_TOKEN')) throw new Error('Ajoutez GITHUB_TOKEN dans les propriétés du script.');
  synchroniserAnnonces();
  const handlers = ['surModificationAnnonce', 'synchroniserAnnonces'];
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (handlers.indexOf(t.getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('surModificationAnnonce').forSpreadsheet(TABLEAU_ID).onEdit().create();
  ScriptApp.newTrigger('synchroniserAnnonces').timeBased().everyMinutes(15).create();
  console.log('Déclencheurs installés : modification du tableau + reprise toutes les 15 minutes.');
}

function surModificationAnnonce(e) {
  if (!e || !e.range || e.range.getSheet().getName() !== 'Annonces') return;
  const first = e.range.getColumn(), last = e.range.getLastColumn();
  if (first <= 1 || (first <= 7 && last >= 7)) synchroniserAnnonces();
}

function synchroniserAnnonces() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const props = PropertiesService.getScriptProperties();
    const token = props.getProperty('GITHUB_TOKEN');
    if (!token) throw new Error('Propriété GITHUB_TOKEN manquante.');
    const sheet = SpreadsheetApp.openById(TABLEAU_ID).getSheetByName('Annonces');
    if (!sheet) throw new Error('Onglet Annonces introuvable.');
    const values = sheet.getRange(1, 1, Math.max(1, sheet.getLastRow()), 7).getDisplayValues();
    if (['Référence de l’annonce (interne)', 'Réf annonce (interne)'].indexOf(values[0][0]) === -1 || values[0][6] !== 'Statut') throw new Error('En-têtes Référence / Statut incorrects.');
    const seen = {};
    const statuses = values.slice(1).map(function(row, i) {
      const ref = row[0].trim(), statut = row[6].trim();
      if (!ref && statut) throw new Error('Référence absente ligne ' + (i + 2));
      if (ref && seen[ref]) throw new Error('Référence dupliquée : ' + ref);
      if (ref) seen[ref] = true;
      if (statut && ['En vente', 'Sous compromis', 'Vendu'].indexOf(statut) === -1) throw new Error('Statut invalide ligne ' + (i + 2));
      return [ref, '', '', '', '', '', statut];
    });
    const payload = JSON.stringify({ spreadsheetId: TABLEAU_ID, capturedAt: Date.now(), values: [values[0]].concat(statuses) });
    if (payload.length > 60000) throw new Error('Tableau trop volumineux pour cette synchronisation.');
    const response = UrlFetchApp.fetch('https://api.github.com/repos/' + DEPOT + '/actions/workflows/' + WORKFLOW + '/dispatches', {
      method: 'post', contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      payload: JSON.stringify({ ref: props.getProperty('GITHUB_BRANCH') || 'main', inputs: { snapshot: payload } }),
      muteHttpExceptions: true
    });
    if (response.getResponseCode() !== 204) throw new Error('GitHub refuse la synchronisation (HTTP ' + response.getResponseCode() + '). Vérifiez le jeton, la branche et la publication du workflow.');
    console.log('Statuts transmis à GitHub. Vérifiez le résultat dans Actions puis sur le site.');
  } finally { lock.releaseLock(); }
}
