document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('[data-bb-dropdown]').forEach(function (dropdown) {
    var trigger = dropdown.querySelector('[data-bb-dropdown-trigger]');
    var label = dropdown.querySelector('[data-bb-dropdown-label]');
    var options = dropdown.querySelector('[data-bb-dropdown-options]');

    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = options.classList.toggle('is-open');
      trigger.setAttribute('aria-expanded', String(isOpen));
    });

    options.querySelectorAll('.bb-filter-option').forEach(function (item) {
      item.addEventListener('click', function () {
        options.querySelectorAll('.bb-filter-option').forEach(function (i) {
          i.classList.remove('is-selected');
        });
        item.classList.add('is-selected');
        label.textContent = item.textContent;
        options.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
      });
    });

    document.addEventListener('click', function (e) {
      if (!dropdown.contains(e.target)) {
        options.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
      }
    });
  });
});