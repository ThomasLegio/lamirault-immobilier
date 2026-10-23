(() => {
  const header = document.querySelector('.li-header');
  if (!header) return;
  const toggle = header.querySelector('.li-menu-toggle');
  const navigation = header.querySelector('.li-navigation');
  const dropdowns = [...header.querySelectorAll('.li-dropdown')];
  const mobile = window.matchMedia('(max-width: 1179px)');
  const closeDropdowns = (except) => dropdowns.forEach((dropdown) => {
    if (dropdown !== except) dropdown.open = false;
  });
  const setMenu = (open, restoreFocus = false) => {
    navigation.hidden = mobile.matches && !open;
    toggle.setAttribute('aria-expanded', String(mobile.matches && open));
    toggle.textContent = mobile.matches && open ? 'Fermer' : 'Menu';
    if (!open) closeDropdowns();
    if (restoreFocus) toggle.focus();
  };
  const normalizePath = (path) => path.replace(/\/index\.html$/, '').replace(/\/+$/, '') || '/';
  const currentPath = normalizePath(window.location.pathname);
  document.querySelectorAll('.li-header a[href], .li-footer a[href]').forEach((link) => {
    const target = new URL(link.getAttribute('href'), window.location.href);
    if (target.origin === window.location.origin && normalizePath(target.pathname) === currentPath) {
      link.setAttribute('aria-current', 'page');
      const dropdown = link.closest('.li-dropdown');
      dropdown?.querySelector('summary').classList.add('li-current-parent');
    }
  });
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  dropdowns.forEach((dropdown) => {
    dropdown.addEventListener('toggle', () => {
      dropdown.querySelector('summary').setAttribute('aria-expanded', String(dropdown.open));
      if (dropdown.open) closeDropdowns(dropdown);
    });
    const summary = dropdown.querySelector('summary');
    summary.setAttribute('aria-expanded', 'false');
    summary.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        closeDropdowns(dropdown);
        dropdown.open = true;
        dropdown.querySelector('a')?.focus();
      }
    });
  });
  header.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const currentDropdown = event.target.closest('.li-dropdown[open]');
    if (currentDropdown) {
      currentDropdown.open = false;
      currentDropdown.querySelector('summary').focus();
    } else if (mobile.matches && toggle.getAttribute('aria-expanded') === 'true') {
      setMenu(false, true);
    } else {
      closeDropdowns();
    }
  });
  document.addEventListener('click', (event) => {
    if (!header.contains(event.target)) setMenu(false);
    else if (!event.target.closest('.li-dropdown')) closeDropdowns();
  });
  header.addEventListener('focusout', (event) => {
    if (event.relatedTarget && !header.contains(event.relatedTarget)) setMenu(false);
    const dropdown = event.target.closest('.li-dropdown');
    if (dropdown && event.relatedTarget && !dropdown.contains(event.relatedTarget)) dropdown.open = false;
  });
  navigation.addEventListener('click', (event) => {
    if (event.target.closest('a')) setMenu(false);
  });
  mobile.addEventListener('change', () => setMenu(false));
  document.querySelectorAll('.li-copyright-year').forEach((year) => {
    year.textContent = String(new Date().getFullYear());
  });
  setMenu(false);
})();
