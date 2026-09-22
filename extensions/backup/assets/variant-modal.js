(()=>{
    let overlay = document.getElementById('bbVariantModalOverlay');
    let closeBtn = document.getElementById('bbVariantModalClose');
    let openTrigers = document.querySelectorAll('[data-open-variant-modal]');

    openTrigers.forEach((trigger)=>{
        trigger.addEventListener('click', (e)=>{
           e.preventDefault();
           overlay.classList.add('is-open')
        })
    })

    closeBtn.addEventListener('click',()=>{
        overlay.classList.remove('is-open')
    })

    overlay.addEventListener('click',(e)=>{
        if(e.target === overlay){
            overlay.classList.remove('is-open')
        }
    })
})();