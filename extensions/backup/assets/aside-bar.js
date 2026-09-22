document.addEventListener('DOMContentLoaded', function () {
  let toggles = document.querySelectorAll('.bb-bundle-toggle');

  toggles.forEach(function (toggle) {
    toggle.addEventListener('click', function () {
      let card = toggle.closest('.bb-sidebar-card');
      if (!card) return;

      let panel = card.querySelector('.bb-bundle-panel');
      if (!panel) return;

      let isOpen = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!isOpen));
      panel.classList.toggle('is-open', !isOpen);
    });
  });
});