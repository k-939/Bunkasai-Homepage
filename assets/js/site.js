document.addEventListener('DOMContentLoaded', async () => {
  // --- Exhib cards (no jQuery dependency) ---
  try {
    const res = await fetch('assets/data.json', { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    if (!Array.isArray(data)) return;

    for (let i = 0; i < data.length; i++) {
      const item = data[i] || {};
      const groupName = item.group;
      if (!groupName) continue;

      const mount = document.getElementById('exhib_' + groupName);
      if (!mount) continue;

      const href = (item.href || '') + '#' + groupName;
      const group = '<span class="group">' + groupName + '</span>';
      const title = '<span class="title">' + (item.title || '') + '</span>';
      const desc = '<div class="desc">' + (item.desc || '') + '</div>';
      const image = '<img src="' + (item.image || '') + '" class="map">';
      const card = '<a href="' + href + '">' + '<div class="exhib_card">' + group + title + desc + image + '</div></a>';
      mount.insertAdjacentHTML('beforeend', card);
    }
  } catch (e) {
    // ignore
  }
});
// Header & Footer inject + Countdown + Swiper init + Pinch zoom block
(function pinchOnlyBlock(){
  const ENABLE_PINCH = false; // true にするとピンチ再許可
  if(ENABLE_PINCH) return;
  ['gesturestart','gesturechange','gestureend'].forEach(ev => {
    document.addEventListener(ev, e => { e.preventDefault(); }, { passive:false });
  });

  const categoryMap = {
    'J.html': '中学展示',
    'S.html': '高校展示',
    'C.html': '部活動',
    'F.html': '模擬店',
    'B.html': '有志演奏',
    'St.html': '講堂舞台企画',
    'CS.html': '部活舞台企画',
    'ngt.html': "Nanzan's Got Talent"
  };

  const DATA_URL = new URL('assets/data.json', document.baseURI).toString();

  const hrefRewriteMap = {
    'J.html': 'exhib/J.html',
    'S.html': 'exhib/S.html',
    'C.html': 'exhib/C.html',
    'V.html': 'exhib/V.html'
  };

  function resolveHref(pageHref) {
    if (!pageHref) return '';
    return hrefRewriteMap[pageHref] || pageHref;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  let cachedItems = null;

  async function fetchItems() {
    if (cachedItems) return cachedItems;
    const response = await fetch(DATA_URL, { cache: 'no-cache' });
    if (!response.ok) throw new Error('データの読み込みに失敗しました');
    const data = await response.json();
    cachedItems = data.map(item => ({
      ...item,
      category: categoryMap[item.href] || 'その他'
    }));
    return cachedItems;
  }

  // project.html: searchable list (must run after DOM is ready)
  function initProjectList() {
    const container = document.querySelector('#cardsContainer');
    const searchInput = document.querySelector('#searchInput');
    const resultSpan = document.querySelector('#resultCount');
    const filterCheckboxes = document.querySelectorAll('#categoryFilters input[type="checkbox"]:not(#selectAll)');
    const selectAllCheckbox = document.querySelector('#selectAll');

    const hasProjectUi = !!(container && searchInput && resultSpan && selectAllCheckbox && filterCheckboxes.length);
    if (!hasProjectUi) return;

    let allItems = [];

    function render() {
      const selectedCategories = [];
      for (const cb of filterCheckboxes) {
        if (cb.checked) selectedCategories.push(cb.value);
      }

      const searchTerm = searchInput.value.trim().toLowerCase();

      const filtered = allItems.filter(item => {
        if (selectedCategories.length > 0 && !selectedCategories.includes(item.category)) return false;
        if (searchTerm !== '') {
          return item.group.toLowerCase().includes(searchTerm) ||
            item.title.toLowerCase().includes(searchTerm) ||
            (item.desc && item.desc.toLowerCase().includes(searchTerm));
        }
        return true;
      });

      resultSpan.innerText = `${filtered.length} 団体 / 全 ${allItems.length} 団体中`;

      if (filtered.length === 0) {
        container.innerHTML = '<div class="no-result">該当する団体なし</div>';
        return;
      }

      let html = '';
      for (const item of filtered) {
        html += `
          <div class="item-card">
            <div class="group-name">${escapeHtml(item.group)}</div>
            <span class="category-badge">${escapeHtml(item.category)}</span>
            <div class="event-name">「${item.title}」</div>
            <div class="description">${item.desc || ''}</div>
          </div>
        `;
      }
      container.innerHTML = html;
    }

    async function loadData() {
      try {
        allItems = await fetchItems();

        searchInput.disabled = false;
        for (const cb of filterCheckboxes) cb.disabled = false;
        selectAllCheckbox.disabled = false;

        render();
      } catch (error) {
        container.innerHTML = `<div class="no-result">❌ ${escapeHtml(error.message)}</div>`;
        resultSpan.innerText = 'エラー';
      }
    }

    for (const cb of filterCheckboxes) {
      cb.addEventListener('change', function () {
        if (!this.checked) {
          selectAllCheckbox.checked = false;
        } else {
          const allChecked = Array.from(filterCheckboxes).every(c => c.checked);
          selectAllCheckbox.checked = allChecked;
        }
        render();
      });
    }

    selectAllCheckbox.addEventListener('change', function () {
      const isChecked = this.checked;
      for (const cb of filterCheckboxes) cb.checked = isChecked;
      render();
    });

    searchInput.addEventListener('input', render);
    loadData();
  }

  async function renderSwiperCards({ container, swiperEl, items }) {
    if (items.length === 0) {
      container.innerHTML = '<div class="swiper-slide"><div class="no-result">該当する団体なし</div></div>';
      return;
    }

    let html = '';
    for (const item of items) {
      const page = resolveHref(item.href);
      const href = `${page}#${encodeURIComponent(item.group)}`;
      const imageHtml = item.image ? `<img src="${item.image}" class="map" alt="">` : '';
      html += `
        <div class="swiper-slide">
          <a href="${href}">
            <div class="exhib_card">
              <span class="group">${escapeHtml(item.group)}</span>
              ${imageHtml}
              <span class="title">${item.title}</span>
              <div class="desc">${item.desc || ''}</div>
            </div>
          </a>
        </div>
      `;
    }
    container.innerHTML = html;

    if (swiperEl && swiperEl.swiper) {
      swiperEl.swiper.update();
      swiperEl.swiper.slideToLoop(0, 0);
    }
  }

  // index.html: class-swiper bulk render into #cardsContainer
  async function renderTopClassCards() {
    const container = document.querySelector('#cardsContainer');
    const swiperEl = document.querySelector('.class-swiper');
    if (!container || !swiperEl) return;
    if (!container.classList.contains('swiper-wrapper')) return;

    try {
      const items = await fetchItems();
      const classItems = items.filter(item => item.category === '中学展示' || item.category === '高校展示');
      await renderSwiperCards({ container, swiperEl, items: classItems });
    } catch (error) {
      container.innerHTML = `<div class="swiper-slide"><div class="no-result">❌ ${escapeHtml(error.message)}</div></div>`;
    }
  }

  async function renderTopClubCards() {
    const container = document.querySelector('#clubCardsContainer');
    const swiperEl = document.querySelector('.club-swiper');
    if (!container || !swiperEl) return;
    if (!container.classList.contains('swiper-wrapper')) return;

    try {
      const items = await fetchItems();
      const clubItems = items.filter(item => item.category === '部活動');
      await renderSwiperCards({ container, swiperEl, items: clubItems });
    } catch (error) {
      container.innerHTML = `<div class="swiper-slide"><div class="no-result">❌ ${escapeHtml(error.message)}</div></div>`;
    }
  }

  async function renderTopFoodCards() {
    const container = document.querySelector('#foodCardsContainer');
    const swiperEl = document.querySelector('.food-swiper');
    if (!container || !swiperEl) return;
    if (!container.classList.contains('swiper-wrapper')) return;

    try {
      const items = await fetchItems();
      const foodItems = items.filter(item => item.category === '模擬店');
      await renderSwiperCards({ container, swiperEl, items: foodItems });
    } catch (error) {
      container.innerHTML = `<div class="swiper-slide"><div class="no-result">❌ ${escapeHtml(error.message)}</div></div>`;
    }
  }

  // Expose for debugging if needed
  window.__renderTopClassCards = renderTopClassCards;
  window.__renderTopClubCards = renderTopClubCards;
  window.__renderTopFoodCards = renderTopFoodCards;

  // index.html and others: inject cards into existing #exhib_* mounts (legacy layout)
  async function renderExhibPlaceholders() {
    const mounts = document.querySelectorAll('[id^="exhib_"]');
    if (!mounts.length) return;

    const items = await fetchItems();
    const byGroup = new Map(items.map(item => [String(item.group), item]));

    for (const mount of mounts) {
      const group = mount.id.slice('exhib_'.length);
      const item = byGroup.get(group);
      if (!item) continue;

      const page = resolveHref(item.href);
      const href = `${page}#${encodeURIComponent(item.group)}`;
      const imageHtml = item.image ? `<img src="${item.image}" class="map" alt="">` : '';

      mount.innerHTML = `
        <a href="${href}">
          <div class="exhib_card">
            <span class="group">${escapeHtml(item.group)}</span>
            ${imageHtml}
            <span class="title">${item.title}</span>
            <div class="desc">${item.desc || ''}</div>
          </div>
        </a>
      `;
    }
  }

  window.__renderExhibPlaceholders = renderExhibPlaceholders;

  (function pinchOnlyBlock(){
    const ENABLE_PINCH = false; // true にするとピンチ再許可
    if(ENABLE_PINCH) return;
    ['gesturestart','gesturechange','gestureend'].forEach(ev => {
      document.addEventListener(ev, e => { e.preventDefault(); }, { passive:false });
    });

    function isPinchEvent(e){
      return (e.touches && e.touches.length > 1) || (typeof e.scale === 'number' && e.scale !== 1);
    }
    window.addEventListener('touchmove', e => {
      if(isPinchEvent(e)) e.preventDefault();
    }, { passive:false });
  })();

  document.addEventListener('DOMContentLoaded', async () => {
    // Top page sliders should be rendered before Swiper init
    if (window.__renderTopClassCards) {
      try { await window.__renderTopClassCards(); } catch (e) { /* ignore */ }
    }
    if (window.__renderTopClubCards) {
      try { await window.__renderTopClubCards(); } catch (e) { /* ignore */ }
    }
    if (window.__renderTopFoodCards) {
      try { await window.__renderTopFoodCards(); } catch (e) { /* ignore */ }
    }

    // Legacy exhib_ placeholders (other pages)
    if (window.__renderExhibPlaceholders) {
      try { await window.__renderExhibPlaceholders(); } catch (e) { /* ignore */ }
    }

    // project.html
    try { initProjectList(); } catch (e) { /* ignore */ }

  // Inject header
  const headerMount = document.querySelector('#header');
  if (headerMount) {
    fetch('template/menu.html').then(r => r.text()).then(html => {
      headerMount.innerHTML = html;
    }).catch(() => {/* ignore */});
  }

  // Inject footer if a mount exists
  const footerMount = document.querySelector('#footer');
  if (footerMount) {
    fetch('template/footer_template.html').then(r => r.text()).then(html => {
      footerMount.innerHTML = html;
    }).catch(() => {/* ignore */});
  }

  // Countdown to event start
  const eventDate = new Date('2026-09-19T09:00:00+09:00');
  const els = {
    days: document.getElementById('days'),
    hours: document.getElementById('hours'),
    minutes: document.getElementById('minutes'),
    seconds: document.getElementById('seconds'),
    title: document.querySelector('.countdown-title')
  };

  function updateCountdown() {
    if (!els.days || !els.hours || !els.minutes || !els.seconds) return;
    const now = new Date();
    const diff = eventDate - now;
    if (diff > 0) {
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      els.days.textContent = String(days).padStart(2, '0');
      els.hours.textContent = String(hours).padStart(2, '0');
      els.minutes.textContent = String(minutes).padStart(2, '0');
      els.seconds.textContent = String(seconds).padStart(2, '0');
    } else {
      els.days.textContent = '00';
      els.hours.textContent = '00';
      els.minutes.textContent = '00';
      els.seconds.textContent = '00';
      // if (els.title) els.title.textContent = '飛翔祭開催中！'; //
    }
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);

  // --- Swiper 自動初期化（存在時のみ、未初期化要素のみ） ---
  if (window.Swiper) {
    document.querySelectorAll('.class-swiper').forEach(el => {
      if (el.swiper) return;
      new Swiper(el, {
        slidesPerView: 3,              // デフォルトは3枚（デスクトップ）
        spaceBetween: 24,
        centeredSlides: false,
        loop: true,
        autoplay: { delay: 3000, disableOnInteraction: false },
        pagination: { el: el.querySelector('.swiper-pagination'), clickable: true },
        breakpoints: {
          0:   { slidesPerView: 1, spaceBetween: 16 },  // 900px未満は常に1枚
          600: { slidesPerView: 1, spaceBetween: 20 },  // タブレットも1枚
          900: { slidesPerView: 3, spaceBetween: 24 }   // デスクトップで3枚
        }
      });
    });

    document.querySelectorAll('.club-swiper').forEach(el => {
      if (el.swiper) return;
      new Swiper(el, {
        slidesPerView: 3,              // デフォルトは3枚（デスクトップ）
        spaceBetween: 24,
        centeredSlides: false,
        loop: true,
        autoplay: { delay: 3500, disableOnInteraction: false },
        pagination: { el: el.querySelector('.swiper-pagination'), clickable: true },
        breakpoints: {
          0:   { slidesPerView: 1, spaceBetween: 16 },  // 900px未満は常に1枚
          600: { slidesPerView: 1, spaceBetween: 20 },  // タブレットも1枚
          900: { slidesPerView: 3, spaceBetween: 24 }   // デスクトップで3枚
        }
      });
    });

    document.querySelectorAll('.food-swiper').forEach(el => {
      if (el.swiper) return;
      new Swiper(el, {
        slidesPerView: 3,              // デフォルトは3枚（デスクトップ）
        spaceBetween: 24,
        centeredSlides: false,
        loop: true,
        autoplay: { delay: 3500, disableOnInteraction: false },
        pagination: { el: el.querySelector('.swiper-pagination'), clickable: true },
        breakpoints: {
          0:   { slidesPerView: 1, spaceBetween: 16 },  // 900px未満は常に1枚
          600: { slidesPerView: 1, spaceBetween: 20 },  // タブレットも1枚
          900: { slidesPerView: 3, spaceBetween: 24 }   // デスクトップで3枚
        }
      });
    });

    document.querySelectorAll('.indv-swiper').forEach(el => {
      if (el.swiper) return;
      new Swiper(el, {
        slidesPerView: 3,              // デフォルトは3枚（デスクトップ）
        spaceBetween: 24,
        centeredSlides: false,
        loop: true,
        autoplay: false,
        pagination: { el: el.querySelector('.swiper-pagination'), clickable: true },
        breakpoints: {
          0:   { slidesPerView: 1, spaceBetween: 16 },  // 900px未満は常に1枚
          600: { slidesPerView: 1, spaceBetween: 20 },  // タブレットも1枚
          900: { slidesPerView: 3, spaceBetween: 24 }   // デスクトップで3枚
        }
      });
    });
  }

    // --- ナビのアクティブ表示 ---
    try {
      const current = new URL(location.href);
      const norm = p => p.replace(/\/index\.html?$/i, '/').toLowerCase();
      const curPath = norm(current.pathname);
      document.querySelectorAll('a[href]').forEach(a => {
        const href = a.getAttribute('href');
        if (!href || /^https?:\/\//i.test(href) || href.startsWith('mailto:') || href.startsWith('#')) return;
        const targetPath = norm(new URL(href, current.origin).pathname);
        if (targetPath === curPath) a.classList.add('is-active');
      });
    } catch (e) {
      // no-op
    }
  });

  // Header & Footer inject + Countdown + Swiper init + Pinch zoom block
})();
