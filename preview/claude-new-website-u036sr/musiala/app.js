(function () {
  const langBtn = document.getElementById('langBtn');
  const langMenu = document.getElementById('langMenu');
  const langLabel = document.getElementById('langLabel');

  if (!langBtn || !langMenu || !langLabel) return;

  function closeMenu() {
    langMenu.hidden = true;
    langBtn.setAttribute('aria-expanded', 'false');
  }

  function openMenu() {
    langMenu.hidden = false;
    langBtn.setAttribute('aria-expanded', 'true');
  }

  langBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (langMenu.hidden) openMenu();
    else closeMenu();
  });

  langMenu.addEventListener('click', (e) => {
    const option = e.target.closest('[data-lang]');
    if (!option) return;
    langLabel.textContent = option.dataset.lang.toUpperCase();
    langMenu.querySelectorAll('[aria-selected]').forEach((el) => {
      el.setAttribute('aria-selected', String(el === option));
    });
    closeMenu();
  });

  document.addEventListener('click', (e) => {
    if (!langMenu.hidden && !langMenu.contains(e.target) && e.target !== langBtn) {
      closeMenu();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !langMenu.hidden) {
      closeMenu();
      langBtn.focus();
    }
  });
})();
