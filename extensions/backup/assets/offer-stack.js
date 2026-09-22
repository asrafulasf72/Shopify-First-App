document.addEventListener('DOMContentLoaded', function () {
  let cards = document.querySelectorAll('[data-bb-collapsible]');

  // Prottek card er jonno automatic unique id set kora (aria-controls er jonno)
  cards.forEach(function (card, index) {
    let toggleEl = card.querySelector('[data-bb-toggle]');
    let panel = card.querySelector('.bb-collapse');
    if (!toggleEl || !panel) return;

    let panelId = 'bb-panel-' + (index + 1);
    panel.id = panelId;
    toggleEl.setAttribute('aria-controls', panelId);
  });

  function toggleCard(toggleEl) {
    let card = toggleEl.closest('[data-bb-collapsible]');
    if (!card) return;

    var isOpen = card.classList.toggle('is-open');
    toggleEl.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }

  // Click
  document.addEventListener('click', function (e) {
    let toggleEl = e.target.closest('[data-bb-toggle]');
    if (toggleEl) toggleCard(toggleEl);
  });

  // Keyboard (Enter / Space)
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    let toggleEl = e.target.closest('[data-bb-toggle]');
    if (toggleEl) {
      e.preventDefault();
      toggleCard(toggleEl);
    }
  });
});