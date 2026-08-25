const form = document.querySelector('#estimate-form');
const panels = [...document.querySelectorAll('.form-panel')];
const indicators = [...document.querySelectorAll('[data-step-indicator]')];
const errorMessage = document.querySelector('.form-error');
let currentStep = 1;

function fieldsForStep(step) {
  return [...document.querySelector(`[data-panel="${step}"]`).querySelectorAll('input')];
}

function markInvalid(input, invalid) {
  const wrapper = input.closest('.choice-grid, label');
  if (wrapper) wrapper.classList.toggle('invalid', invalid);
}

function validateStep(step) {
  const fields = fieldsForStep(step);
  let valid = true;

  fields.forEach((input) => {
    const fieldValid = input.type === 'radio'
      ? Boolean(form.querySelector(`input[name="${input.name}"]:checked`))
      : input.checkValidity();
    markInvalid(input, !fieldValid);
    if (!fieldValid) valid = false;
  });

  errorMessage.textContent = valid ? '' : 'Merci de compléter tous les champs obligatoires avant de continuer.';
  return valid;
}

function showStep(step) {
  currentStep = step;
  panels.forEach((panel) => panel.classList.toggle('is-active', Number(panel.dataset.panel) === step));
  indicators.forEach((indicator, index) => {
    indicator.classList.toggle('is-active', index + 1 === step);
    indicator.classList.toggle('is-complete', index + 1 < step);
    const circle = indicator.querySelector('span');
    circle.textContent = index + 1 < step ? '✓' : String(index + 1);
  });
  errorMessage.textContent = '';
  if (window.innerWidth < 760) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.querySelectorAll('.next-button').forEach((button) => {
  button.addEventListener('click', () => {
    if (validateStep(currentStep)) showStep(Math.min(currentStep + 1, 3));
  });
});

document.querySelectorAll('.back-button').forEach((button) => {
  button.addEventListener('click', () => showStep(Math.max(currentStep - 1, 1)));
});

form.addEventListener('input', (event) => {
  markInvalid(event.target, false);
  errorMessage.textContent = '';
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!validateStep(3)) return;

  form.querySelector('.steps').hidden = true;
  panels.forEach((panel) => panel.classList.remove('is-active'));
  form.querySelector('.form-success').hidden = false;
  errorMessage.textContent = '';
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

document.querySelectorAll('.faq-list details').forEach((detail) => {
  detail.addEventListener('toggle', () => {
    if (!detail.open) return;
    document.querySelectorAll('.faq-list details').forEach((other) => {
      if (other !== detail) other.open = false;
    });
  });
});
