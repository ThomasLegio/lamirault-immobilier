const form = document.querySelector('#estimate-form');
const panels = [...form.querySelectorAll('.form-panel')];
const indicators = [...form.querySelectorAll('[data-step-indicator]')];
const errorMessage = form.querySelector('.form-error');
const leadsEndpoint = 'https://script.google.com/macros/s/AKfycbylZQSBgz-SRxRVkpYCLHU9O2VnuG6UXM34KMxH1fGUOKBfezdiQEU7NPuPKDlkomKDPg/exec';
const postcode = form.elements.postcode;
const citySelect = form.querySelector('#city-select');
const cityManual = form.querySelector('#city-manual');
const cityHelp = form.querySelector('#city-help');
const retryCity = form.querySelector('#retry-city');
const cityCache = new Map();
const fieldErrors = new Map();
let currentStep = 1;
let editingReview = false;
let isSubmitting = false;
let isComplete = false;
let cityState = 'idle';
let cityRequest;
let cityTimer;
let cityVersion = 0;
let previousPropertyType = '';

const valueOf = (name) => new FormData(form).get(name) || '';
const scrollBehavior = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

// A single error per field or radio group, linked to each of its controls.
form.querySelectorAll('input, select').forEach((input) => {
  const wrapper = input.closest('.choice-grid') || input.closest('label');
  if (!fieldErrors.has(wrapper)) {
    const error = document.createElement('span');
    error.className = 'field-error';
    error.id = `field-error-${fieldErrors.size}`;
    error.hidden = true;
    if (wrapper.matches('label:not(.consent)')) wrapper.append(error);
    else wrapper.after(error);
    fieldErrors.set(wrapper, error);
  }
  const descriptions = [input.getAttribute('aria-describedby'), fieldErrors.get(wrapper).id].filter(Boolean);
  input.setAttribute('aria-describedby', descriptions.join(' '));
});

function markInvalid(input, message = '') {
  const wrapper = input.closest('.choice-grid') || input.closest('label');
  const error = fieldErrors.get(wrapper);
  if (!error) return;
  wrapper.classList.toggle('invalid', Boolean(message));
  wrapper.querySelectorAll('input, select').forEach((control) => {
    if (message) control.setAttribute('aria-invalid', 'true');
    else control.removeAttribute('aria-invalid');
  });
  error.textContent = message;
  error.hidden = !message;
}

function fieldsForStep(step) {
  return [...panels[step - 1].querySelectorAll('input, select')].filter((input) => !input.matches(':disabled'));
}

function validationMessage(input) {
  if (input.name !== 'postcode') input.setCustomValidity('');
  if (input.type !== 'radio' && input.type !== 'checkbox' && input.required && !input.value.trim()) {
    input.setCustomValidity('Merci de compléter ce champ.');
  }
  if (input.name === 'phone' && input.value.trim()) {
    const phone = input.value.replace(/[\s.()\-]/g, '');
    if (!/^0[1-9]\d{8}$/.test(phone) && !/^(?:\+|00)[1-9]\d{7,14}$/.test(phone)) {
      input.setCustomValidity('Saisissez 10 chiffres ou un numéro international avec son indicatif.');
    }
  }
  if (input.checkValidity()) return '';
  if (input.validity.customError) return input.validationMessage;
  if (input.type === 'radio') return 'Merci de sélectionner une réponse.';
  if (input.type === 'checkbox') return 'Votre accord est nécessaire pour pouvoir vous recontacter.';
  if (input.name === 'postcode') return 'Saisissez un code postal à 5 chiffres.';
  if (input.name === 'city') return 'Sélectionnez la commune de votre bien.';
  if (input.validity.valueMissing) return 'Merci de compléter ce champ.';
  if (input.type === 'email') return 'Saisissez une adresse email valide (ex. : nom@exemple.fr).';
  if (input.name === 'surface') return 'Saisissez une surface d’au moins 1 m², avec une décimale maximum.';
  if (input.name === 'rooms') return 'Saisissez un nombre entier de pièces, au moins égal à 1.';
  return 'Merci de vérifier ce champ.';
}

function validateStep(step, focus = true) {
  let firstInvalid;
  fieldsForStep(step).forEach((input) => {
    const message = validationMessage(input);
    markInvalid(input, message);
    if (message && !firstInvalid) firstInvalid = input;
  });
  // The city control is disabled while a lookup is pending, so validate that state separately.
  if (step === 1 && (cityState === 'loading' || cityState === 'idle') && !firstInvalid) {
    markInvalid(postcode, cityState === 'loading' ? 'La recherche de votre commune est en cours. Patientez un instant.' : 'Saisissez le code postal pour rechercher votre commune.');
    firstInvalid = postcode;
  }
  if (focus) {
    errorMessage.textContent = firstInvalid ? 'Vérifiez les champs indiqués pour continuer.' : '';
    firstInvalid?.focus();
  }
  return !firstInvalid;
}

function showStep(step) {
  currentStep = step;
  if (step === panels.length) renderReview();
  panels.forEach((panel, index) => panel.classList.toggle('is-active', index + 1 === step));
  indicators.forEach((indicator, index) => {
    indicator.classList.toggle('is-active', index + 1 === step);
    indicator.classList.toggle('is-complete', index + 1 < step);
    if (index + 1 === step) indicator.setAttribute('aria-current', 'step');
    else indicator.removeAttribute('aria-current');
    indicator.querySelector('span').textContent = index + 1 < step ? '✓' : String(index + 1);
  });
  form.querySelector('#current-step').textContent = String(step);
  form.querySelector('#current-step-name').textContent = indicators[step - 1].querySelector('b').textContent;
  form.querySelectorAll('.next-button').forEach((button) => {
    button.firstChild.textContent = editingReview ? 'Vérifier les modifications ' : button.dataset.label;
  });
  errorMessage.textContent = '';
  panels[step - 1].querySelector('h3').focus({ preventScroll: true });
  form.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
}

function setConditionalFields(container, visible) {
  container.hidden = !visible;
  container.querySelectorAll('input').forEach((input) => {
    input.disabled = !visible;
    if (!visible) {
      if (input.type === 'radio') input.checked = false;
      else input.value = '';
      input.setCustomValidity('');
      markInvalid(input);
    }
  });
  if (container.tagName === 'FIELDSET') container.disabled = !visible;
}

function updatePropertyFields() {
  const type = valueOf('propertyType');
  const isLand = type === 'Terrain';
  if (previousPropertyType && isLand !== (previousPropertyType === 'Terrain')) {
    form.elements.surface.value = '';
    markInvalid(form.elements.surface);
  }
  previousPropertyType = type;
  setConditionalFields(form.querySelector('#rooms-field'), !isLand);
  setConditionalFields(form.querySelector('#condition-fields'), !isLand);
  form.querySelector('#surface-label').textContent = isLand ? 'Surface du terrain (m²) *' : type === 'Immeuble' ? 'Surface habitable totale (m²) *' : 'Surface habitable (m²) *';
  form.querySelector('#rooms-label').textContent = type === 'Immeuble' ? 'Nombre total de pièces *' : 'Nombre de pièces *';
  form.querySelector('#property-help').textContent = isLand ? 'Indiquez la surface de la parcelle à estimer, même approximative.' : type === 'Immeuble' ? 'Indiquez la surface habitable et les pièces de l’ensemble des logements.' : 'Une surface approximative suffit pour cette première demande.';
}

function updateProjectFields() {
  const project = valueOf('project');
  const isSale = Boolean(project) && project !== 'Estimation simple';
  setConditionalFields(form.querySelector('#timeline-fields'), isSale);
  setConditionalFields(form.querySelector('#listed-fields'), isSale);
  form.querySelector('#estimate-only-help').hidden = project !== 'Estimation simple';
}

function setCityMode(manual) {
  form.querySelector('#city-select-field').hidden = manual;
  form.querySelector('#city-manual-field').hidden = !manual;
  citySelect.disabled = manual || cityState !== 'ready';
  cityManual.disabled = !manual;
  retryCity.hidden = !manual;
}

function scheduleCityLookup() {
  clearTimeout(cityTimer);
  cityRequest?.abort();
  const version = ++cityVersion;
  const code = postcode.value.trim();
  postcode.setCustomValidity('');
  markInvalid(postcode);
  markInvalid(citySelect);
  markInvalid(cityManual);
  cityManual.value = '';
  cityState = /^\d{5}$/.test(code) ? 'loading' : 'idle';
  citySelect.replaceChildren(new Option(cityState === 'loading' ? 'Recherche en cours…' : 'Saisissez d’abord le code postal', ''));
  setCityMode(false);
  cityHelp.textContent = cityState === 'loading' ? 'Recherche des communes correspondant à votre code postal…' : 'La commune sera proposée à partir des 5 chiffres du code postal.';
  if (cityState === 'loading') cityTimer = setTimeout(() => lookupCities(code, version), 300);
}

async function lookupCities(code, version) {
  const controller = new AbortController();
  cityRequest = controller;
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    let cities = cityCache.get(code);
    if (!cities) {
      // Public commune directory: only the property's postcode is sent to this service.
      const response = await fetch(`https://geo.api.gouv.fr/communes?codePostal=${encodeURIComponent(code)}&fields=nom,code&format=json`, { signal: controller.signal });
      if (!response.ok) throw new Error('Commune lookup failed');
      const data = await response.json();
      if (!Array.isArray(data) || data.some((city) => typeof city.nom !== 'string' || !city.nom.trim())) throw new Error('Invalid commune response');
      cities = [...new Set(data.map((city) => city.nom))].sort((a, b) => a.localeCompare(b, 'fr'));
      cityCache.set(code, cities);
    }
    if (version !== cityVersion) return;
    if (!cities.length) {
      cityState = 'empty';
      postcode.setCustomValidity('Aucune commune trouvée. Vérifiez le code postal du bien.');
      markInvalid(postcode, postcode.validationMessage);
      citySelect.replaceChildren(new Option('Vérifiez le code postal', ''));
      cityHelp.textContent = 'Aucune commune ne correspond à ce code postal. Vérifiez les 5 chiffres saisis.';
      setCityMode(false);
      return;
    }
    cityState = 'ready';
    citySelect.replaceChildren(new Option('Sélectionnez votre commune', ''), ...cities.map((city) => new Option(city, city)));
    if (cities.length === 1) citySelect.value = cities[0];
    setCityMode(false);
    markInvalid(postcode);
    cityHelp.textContent = cities.length === 1 ? `${cities[0]} a été renseignée automatiquement.` : `${cities.length} communes partagent ce code postal. Sélectionnez celle de votre bien.`;
  } catch (error) {
    if (version !== cityVersion) return;
    cityState = 'manual';
    setCityMode(true);
    markInvalid(postcode);
    cityHelp.textContent = 'La recherche est momentanément indisponible. Saisissez votre commune et vérifiez qu’elle correspond au code postal.';
  } finally {
    clearTimeout(timeout);
  }
}

function renderReview() {
  const data = new FormData(form);
  const get = (name) => String(data.get(name) || '').trim();
  const details = [['Surface', `${get('surface')} m²`]];
  if (get('propertyType') !== 'Terrain') details.push(['Pièces', get('rooms')], ['État', get('condition')]);
  const project = [['Votre souhait', get('project')]];
  if (get('project') !== 'Estimation simple') project.push(['Délai', get('timeline')], ['Déjà en vente', get('listed')]);
  const groups = [
    ['Votre bien', 1, [['Type', get('propertyType')], ['Localisation', `${get('postcode')} ${get('city')}`]]],
    ['Les caractéristiques', 2, details],
    ['Votre projet', 3, project],
    ['Vos coordonnées', 4, [['Nom', `${get('firstname')} ${get('lastname')}`], ['Téléphone', get('phone')], ['Email', get('email')]]],
  ];
  const review = form.querySelector('#estimate-review');
  review.replaceChildren();
  groups.forEach(([title, step, entries]) => {
    const section = document.createElement('section');
    section.className = 'review-card';
    const header = document.createElement('div');
    header.className = 'review-heading';
    const heading = document.createElement('h4');
    heading.textContent = title;
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'text-button';
    edit.textContent = 'Modifier';
    edit.setAttribute('aria-label', `Modifier : ${title.toLocaleLowerCase('fr')}`);
    edit.addEventListener('click', () => {
      if (isSubmitting || isComplete) return;
      editingReview = true;
      showStep(step);
    });
    header.append(heading, edit);
    const list = document.createElement('dl');
    entries.forEach(([label, value]) => {
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      term.textContent = label;
      description.textContent = value;
      list.append(term, description);
    });
    section.append(header, list);
    review.append(section);
  });
}

function validateAllSteps(lastStep) {
  for (let step = 1; step <= lastStep; step++) {
    if (!validateStep(step, false)) {
      showStep(step);
      validateStep(step);
      return false;
    }
  }
  return true;
}

function continueForm() {
  if (isSubmitting || isComplete || !validateStep(currentStep)) return;
  if (editingReview || currentStep === panels.length - 1) {
    if (!validateAllSteps(panels.length - 1)) return;
    editingReview = false;
    showStep(panels.length);
  } else {
    showStep(Math.min(currentStep + 1, panels.length));
  }
}

form.querySelectorAll('.next-button').forEach((button) => {
  button.dataset.label = button.firstChild.textContent;
  button.addEventListener('click', continueForm);
});
form.querySelectorAll('.back-button').forEach((button) => {
  button.addEventListener('click', () => {
    if (isSubmitting || isComplete) return;
    editingReview = false;
    showStep(Math.max(currentStep - 1, 1));
  });
});

function clearFieldError(event) {
  const input = event.target;
  if (!input.matches('input, select')) return;
  if (input.name !== 'postcode') input.setCustomValidity('');
  markInvalid(input);
  errorMessage.textContent = '';
}
form.addEventListener('input', clearFieldError);
form.addEventListener('change', (event) => {
  clearFieldError(event);
  if (event.target.name === 'propertyType') updatePropertyFields();
  if (event.target.name === 'project') updateProjectFields();
});
postcode.addEventListener('input', scheduleCityLookup);
retryCity.addEventListener('click', scheduleCityLookup);
// Enter advances the current step; only the final step can send a request.
form.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && event.target.matches('input:not([type="radio"]):not([type="checkbox"])') && currentStep < panels.length) {
    event.preventDefault();
    continueForm();
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (isSubmitting || isComplete) return;
  if (currentStep < panels.length) {
    continueForm();
    return;
  }
  if (!validateAllSteps(panels.length)) return;

  const data = new FormData(form);
  // Keep the existing lead field names; irrelevant answers are sent as empty values.
  ['rooms', 'condition', 'timeline', 'listed'].forEach((name) => {
    if (!data.has(name)) data.set(name, '');
  });
  for (const [name, value] of data) {
    if (typeof value === 'string') data.set(name, value.trim());
  }
  const controls = [...form.querySelectorAll('input, select, button')].filter((control) => !control.matches(':disabled'));
  const submitButton = form.querySelector('.submit-button');
  isSubmitting = true;
  controls.forEach((control) => { control.disabled = true; });
  submitButton.textContent = 'Envoi en cours…';
  form.setAttribute('aria-busy', 'true');
  errorMessage.textContent = '';

  try {
    // The existing Google Apps Script endpoint uses an opaque no-cors response.
    const response = await fetch(leadsEndpoint, { method: 'POST', mode: 'no-cors', body: data });
    if (response.type !== 'opaque' && !response.ok) throw new Error('Submission failed');
    isComplete = true;
    form.querySelector('.form-progress').hidden = true;
    panels.forEach((panel) => panel.classList.remove('is-active'));
    const successMessage = form.querySelector('.form-success');
    successMessage.hidden = false;
    form.removeAttribute('aria-busy');
    successMessage.focus({ preventScroll: true });
    form.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
  } catch (error) {
    controls.forEach((control) => { control.disabled = false; });
    submitButton.textContent = 'Envoyer ma demande';
    errorMessage.textContent = "L’envoi n’a pas fonctionné. Vos réponses sont conservées. Merci de réessayer ou de nous contacter directement.";
  } finally {
    isSubmitting = false;
    form.removeAttribute('aria-busy');
  }
});

updatePropertyFields();
updateProjectFields();
if (postcode.value) scheduleCityLookup();

// Keep the existing mobile CTA clear of the form and the footer's own actions.
const stickyCta = document.querySelector('.sticky-cta');
if (stickyCta && 'IntersectionObserver' in window) {
  const visibleSections = new Set();
  const ctaObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) visibleSections.add(entry.target);
      else visibleSections.delete(entry.target);
    });
    stickyCta.classList.toggle('is-hidden', visibleSections.size > 0);
  });
  ctaObserver.observe(form);
  const footer = document.querySelector('.site-footer');
  if (footer) ctaObserver.observe(footer);
}

document.querySelectorAll('.faq-list details').forEach((detail) => {
  detail.addEventListener('toggle', () => {
    if (!detail.open) return;
    document.querySelectorAll('.faq-list details').forEach((other) => {
      if (other !== detail) other.open = false;
    });
  });
});

// Visual enhancement only: the heading keeps a stable, accessible "Poitiers".
function initCommuneRotation() {
  const location = document.querySelector('.hero-location');
  if (!location) return;

  const communes = [
    'Poitiers', 'Buxerolles', 'Saint-Benoît', 'Mignaloux-Beauvoir', 'Biard',
    'Vouneuil-sous-Biard', 'Fontaine-le-Comte', 'Chasseneuil-du-Poitou',
    'Migné-Auxances', 'Montamisé', 'Ligugé', 'Jaunay-Marigny',
    'Saint-Georges-lès-Baillargeaux', 'Dissay', 'Nouaillé-Maupertuis',
    'Smarves', 'Vivonne', 'Iteuil', 'Neuville-de-Poitou', 'Avanton',
    'Cissé', 'Rouillé', 'Lusignan', 'Chauvigny', 'Saint-Julien-l’Ars',
    'Fleuré', 'Gençay', 'Mirebeau', 'Vouillé', 'Lencloître', 'Châtellerault',
  ];
  const names = [...location.querySelectorAll('.hero-location-name')];
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0;
  let active = 0;
  let visible = true;
  let timer;

  function syncRotation() {
    clearInterval(timer);
    if (motionPreference.matches) {
      index = 0;
      active = 0;
      names.forEach((name, position) => {
        name.textContent = position === 0 ? communes[0] : '';
        name.classList.toggle('is-active', position === 0);
      });
    }
    if (motionPreference.matches || !visible || document.hidden) return;
    timer = setInterval(() => {
      index = (index + 1) % communes.length;
      const next = 1 - active;
      names[next].textContent = communes[index];
      names[next].classList.add('is-active');
      names[active].classList.remove('is-active');
      active = next;
    }, 3000);
  }

  motionPreference.addEventListener('change', syncRotation);
  document.addEventListener('visibilitychange', syncRotation);
  window.addEventListener('pagehide', () => clearInterval(timer));
  window.addEventListener('pageshow', syncRotation);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      syncRotation();
    });
    observer.observe(location);
  }
  syncRotation();
}

initCommuneRotation();
