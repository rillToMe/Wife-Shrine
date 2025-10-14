(function () {
  const row = document.getElementById('waifuRow');
  if (!row) return;
  const cards = Array.from(row.querySelectorAll('.card'));

  function clamp(n, a, b){ return Math.min(b, Math.max(a, n)); }
  function hslString(h, s, l){ return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`; }

  function dominantColorFromImage(img){
    const W = 24, H = 24;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently:true });
    ctx.drawImage(img, 0, 0, W, H);
    const data = ctx.getImageData(0,0,W,H).data;

    let r = 0, g = 0, b = 0, count = 0;
    for (let i = 0; i < data.length; i += 4){
      const rr = data[i], gg = data[i+1], bb = data[i+2], aa = data[i+3];
      if (aa < 200) continue;
      const max = Math.max(rr,gg,bb), min = Math.min(rr,gg,bb);
      const lum = (max + min) / 2;
      if (lum < 30 || lum > 230) continue;
      r += rr; g += gg; b += bb; count++;
    }
    if (!count) return { h: 330, s: 80, l: 60 };

    r /= count; g /= count; b /= count;
    let R=r/255, G=g/255, B=b/255;
    const cmax=Math.max(R,G,B), cmin=Math.min(R,G,B);
    let hue=0, sat=0, light=(cmax+cmin)/2;
    if (cmax!==cmin){
      const d=cmax-cmin;
      sat = light>0.5 ? d/(2-cmax-cmin) : d/(cmax+cmin);
      switch(cmax){
        case R: hue=(G-B)/d + (G<B?6:0); break;
        case G: hue=(B-R)/d + 2; break;
        case B: hue=(R-G)/d + 4; break;
      }
      hue*=60;
    }
    return { h:hue, s:sat*100, l:light*100 };
  }

  function applyAmbientGlow(card, hsl){
    const a1 = hslString(hsl.h, clamp(hsl.s,40,90), clamp(hsl.l,45,65));
    const h2 = (hsl.h + 30) % 360;
    const a2 = hslString(h2, clamp(hsl.s*0.9,35,85), clamp(hsl.l,45,65));
    card.style.setProperty('--glow1', a1);
    card.style.setProperty('--glow2', a2);
  }

  function setBgFromData(card) {
    if (!card || card.dataset.loaded === 'true') return;
    const url = card.dataset.bg;
    if (!url) return;
    card.dataset.loaded = 'loading';

    const img = new Image();
    img.decoding = 'async';
    img.loading = 'eager';
    img.src = url;

    img.onload = () => {
      card.style.setProperty('--bg', `url('${url.replace(/'/g, "\\'")}')`);
      const hsl = dominantColorFromImage(img);
      applyAmbientGlow(card, hsl);
      card.dataset.loaded = 'true';
      card.classList.remove('loading');
    };
    img.onerror = () => { delete card.dataset.loaded; };
  }

  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setBgFromData(entry.target);
            io.unobserve(entry.target);
          }
        });
      }, { root: null, rootMargin: '200px', threshold: 0.01 })
    : null;
  cards.forEach(c => { if (io) io.observe(c); else setBgFromData(c); });

  ['mouseenter','focusin','touchstart'].forEach(evt=>{
    row.addEventListener(evt,(e)=>{
      const card = e.target.closest('.card');
      if (!card) return;
      setBgFromData(card);
    },{passive:true});
  });

  function activate(card){
    if (isUserHoveringRow) return; 
    cards.forEach(c => c.classList.toggle('is-active', c === card));
    setBgFromData(card);
    currentIndex = cards.indexOf(card);
  }

  cards.forEach(card=>{
    card.addEventListener('click',(e)=>{ e.preventDefault(); openModal(card); });
    card.addEventListener('keydown',(e)=>{
      if (e.key==='Enter'||e.key===' '){ e.preventDefault(); openModal(card); }
    });
    card.setAttribute('tabindex','0');
  });

  row.addEventListener('mousemove',(e)=>{
    const rect=row.getBoundingClientRect();
    const px=(e.clientX-rect.left)/rect.width-0.5;
    const py=(e.clientY-rect.top)/rect.height-0.5;
    const moveX=(px*10).toFixed(2)+'px';
    const moveY=(py*10).toFixed(2)+'px';
    cards.forEach(c=>{
      if (c.matches(':hover') || c.classList.contains('is-active')){
        c.style.setProperty('--mx',moveX);
        c.style.setProperty('--my',moveY);
      } else {
        c.style.setProperty('--mx','0px');
        c.style.setProperty('--my','0px');
      }
    });
  });
  row.addEventListener('mouseleave',()=>{
    cards.forEach(c=>{
      c.style.setProperty('--mx','0px');
      c.style.setProperty('--my','0px');
    });
  });

  const lb = document.getElementById('lightbox');
  const lbPanel = lb.querySelector('.lb-panel');
  const lbImg = lb.querySelector('.lb-img');
  const lbTitle = lb.querySelector('.lb-title');
  const lbSub = lb.querySelector('.lb-sub');
  const lbQuote = lb.querySelector('.lb-quote');
  const btnClose = lb.querySelector('.lb-close');
  const btnPrev = lb.querySelector('.lb-prev');
  const btnNext = lb.querySelector('.lb-next');
  let currentIndex = -1;

  function fillModalFromCard(card){
    const url = card.dataset.bg || '';
    const name = card.dataset.name || card.querySelector('.label')?.textContent || 'Unknown';
    const anime = card.dataset.anime || '';
    const quote = card.dataset.quote || '';
    setBgFromData(card);
    lbImg.style.backgroundImage = `url('${url.replace(/'/g, "\\'")}')`;
    lbTitle.textContent = name;
    lbSub.textContent = anime ? `From: ${anime}` : '';
    lbQuote.textContent = quote;
    const cs = getComputedStyle(card);
    lb.style.setProperty('--accent-1', cs.getPropertyValue('--glow1'));
  }

  function openModal(card){
    activate(card);
    currentIndex = cards.indexOf(card);
    fillModalFromCard(card);
    lb.setAttribute('aria-hidden','false');
    setTimeout(()=>lbPanel.focus(),0);
    stopIdle();
  }
  function closeModal(){
    lb.setAttribute('aria-hidden','true');
    cards.forEach(c=>c.classList.remove('is-active'));
    resetIdle();
  }
  function showAt(idx){
    if (idx<0) idx=cards.length-1;
    if (idx>=cards.length) idx=0;
    currentIndex=idx;
    fillModalFromCard(cards[idx]);
  }
  btnClose.addEventListener('click',closeModal);
  btnPrev.addEventListener('click',()=>showAt(currentIndex-1));
  btnNext.addEventListener('click',()=>showAt(currentIndex+1));
  lb.addEventListener('click',(e)=>{ if(e.target.classList.contains('lb-backdrop')) closeModal(); });

  window.addEventListener('keydown',(e)=>{
    if (lb.getAttribute('aria-hidden')==='false'){
      if (e.key==='Escape') closeModal();
      else if (e.key==='ArrowLeft') showAt(currentIndex-1);
      else if (e.key==='ArrowRight') showAt(currentIndex+1);
    }
  });

  let idleTimer=null, slideTimer=null;
  const IDLE_MS=10000;
  const STEP_MS=4000;
  let isUserHoveringRow=false;
  let isAutoSliding=false;

  row.addEventListener('mouseenter',()=>{
    isUserHoveringRow=true;
    stopSlide();
    cards.forEach(c=>c.classList.remove('is-active'));
  });
  row.addEventListener('mouseleave',()=>{
    isUserHoveringRow=false;
    resetIdle();
  });

  function startSlide(){
    if (slideTimer) return;
    isAutoSliding=true;
    if (currentIndex<0) currentIndex=0;
    activate(cards[currentIndex]);
    slideTimer=setInterval(()=>{
      if (isUserHoveringRow) return;
      if (lb.getAttribute('aria-hidden')==='false') return;
      currentIndex=(currentIndex+1)%cards.length;
      activate(cards[currentIndex]);
      cards[currentIndex].scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});
    },STEP_MS);
  }
  function stopSlide(){
    isAutoSliding=false;
    if (slideTimer){ clearInterval(slideTimer); slideTimer=null; }
  }
  function resetIdle(){
    stopSlide();
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer=setTimeout(startSlide,IDLE_MS);
  }
  function stopIdle(){
    if (idleTimer){ clearTimeout(idleTimer); idleTimer=null; }
    stopSlide();
  }

  ['mousemove','keydown','touchstart','wheel','click'].forEach(evt=>{
    window.addEventListener(evt,resetIdle,{passive:true});
  });
  resetIdle();

})();


function openCard(card){
  if (!card) return;
  if (typeof setBgFromData==='function') setBgFromData(card);
  if (typeof openModal==='function') openModal(card);
  else if (typeof activate==='function') activate(card);
}
document.addEventListener('click',(e)=>{
  const btn=e.target.closest('.cta-details');
  if(!btn) return;
  e.preventDefault(); e.stopPropagation();
  const card=btn.closest('.card');
  openCard(card);
});
document.addEventListener('keydown',(e)=>{
  if(e.key!=='Enter'&&e.key!==' ')return;
  const btn=e.target.closest?.('.cta-details');
  if(!btn)return;
  e.preventDefault();
  const card=btn.closest('.card');
  openCard(card);
});
document.addEventListener('DOMContentLoaded',()=>{
  const isTouch=matchMedia('(hover: none)').matches;
  document.querySelectorAll('.cta-details').forEach(btn=>{
    btn.textContent=isTouch?'Tap for details':'Click for details';
  });
});
