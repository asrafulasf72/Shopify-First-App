// bb-scroll-drag.js
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('[data-bb-scroll-drag]').forEach(function (row) {
    row.addEventListener('wheel', function (e) {
      if (e.deltaY === 0) return;
      e.preventDefault();
      row.scrollLeft += e.deltaY;
    });

    var isDown = false, startX = 0, startScroll = 0;

    row.addEventListener('mousedown', function (e) {
      isDown = true;
      row.classList.add('is-dragging');
      startX = e.pageX;
      startScroll = row.scrollLeft;
    });

    window.addEventListener('mouseup', function () {
      isDown = false;
      row.classList.remove('is-dragging');
    });

    row.addEventListener('mouseleave', function () {
      isDown = false;
      row.classList.remove('is-dragging');
    });

    row.addEventListener('mousemove', function (e) {
      if (!isDown) return;
      e.preventDefault();
      row.scrollLeft = startScroll - (e.pageX - startX);
    });
  });
});