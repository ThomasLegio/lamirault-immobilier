(() => {
  const gallery = document.querySelector('[data-property-gallery]');
  const dialog = document.querySelector('[data-property-dialog]');
  if (!gallery || !dialog) return;
  const image = dialog.querySelector('[data-gallery-image]');
  const counter = dialog.querySelector('[data-gallery-counter]');
  const thumbnails = Array.from(dialog.querySelectorAll('[data-gallery-thumbnail]'));
  let current = 0;
  let opener;

  function show(index) {
    current = (index + thumbnails.length) % thumbnails.length;
    const selected = thumbnails[current];
    image.src = selected.href;
    image.alt = selected.querySelector('img').alt;
    counter.textContent = `Photo ${current + 1} sur ${thumbnails.length}`;
    thumbnails.forEach((thumbnail, i) => thumbnail.setAttribute('aria-current', String(i === current)));
  }

  gallery.addEventListener('click', event => {
    const photo = event.target.closest('[data-gallery-open]');
    if (!photo || !thumbnails.length || typeof dialog.showModal !== 'function') return;
    event.preventDefault();
    opener = photo;
    show(Number(photo.dataset.galleryOpen));
    dialog.showModal();
  });
  thumbnails.forEach((thumbnail, index) => thumbnail.addEventListener('click', event => {
    event.preventDefault();
    show(index);
  }));
  dialog.querySelector('[data-gallery-close]').addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-gallery-prev]').addEventListener('click', () => show(current - 1));
  dialog.querySelector('[data-gallery-next]').addEventListener('click', () => show(current + 1));
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      show(current + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => opener?.focus());
})();
