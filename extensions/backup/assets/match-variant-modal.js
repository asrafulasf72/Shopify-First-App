document.addEventListener('DOMContentLoaded',  ()=> {
  let overlay = document.querySelector('.bb-modal-overlay');
  if (!overlay) return;

   openModal =()=> {
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

   closeModal=()=> {
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('[data-bb-modal-trigger]').forEach( (btn)=> {
    btn.addEventListener('click', openModal);
  });

  overlay.querySelectorAll('[data-bb-modal-close]').forEach( (btn)=> {
    btn.addEventListener('click', closeModal);
  });

  overlay.addEventListener('click', (e)=> {
    if (e.target === overlay) closeModal();
  });

  document.addEventListener('keydown', (e)=> {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) {
      closeModal();
    }
  });
});