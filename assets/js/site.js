// --- Utilities & Shared Data ---
const DATA_URL = new URL('assets/data.json', document.baseURI).toString();
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

const projectVisibleHrefs = new Set(['F.html', 'B.html', 'St.html', 'CS.html', 'ngt.html']);
const projectExhibVisibleHrefs = new Set(['J.html', 'S.html', 'C.html']);

let cachedItems = null;

function resolveHref(href) {
  return href || '';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}


async function fetchItems() {
  if (cachedItems) return cachedItems;
  try {
    const response = await fetch(DATA_URL, { cache: 'no-cache' });
    if (!response.ok) throw new Error('データの読み込みに失敗しました');
    const data = await response.json();
    cachedItems = data.map(item => ({
      ...item,
      category: categoryMap[item.href] || 'その他'
    }));
    return cachedItems;
  } catch (err) {
    console.error(err);
    return [];
  }
}

// --- Specific Features ---

function initProjectList() {
  const container = document.querySelector('#cardsContainer');
  const searchInput = document.querySelector('#searchInput');
  const resultSpan = document.querySelector('#resultCount');
  const filterCheckboxes = document.querySelectorAll('#categoryFilters input[type="checkbox"]:not(#selectAll)');
  const selectAllCheckbox = document.querySelector('#selectAll');
  
  if (!container || !searchInput || !resultSpan || !selectAllCheckbox || !filterCheckboxes.length) return;

  const pathname = location.pathname.toLowerCase();
  const listMode = pathname.endsWith('/project_exhib.html') ? 'project_exhib'
                 : pathname.endsWith('/project.html') ? 'project'
                 : 'all';

  let allItems = [];
  let visibleItems = [];

  function getVisibleItems(items) {
    if (listMode === 'project_exhib') {
      return items.filter(item => projectExhibVisibleHrefs.has(item.href));
    }
    if (listMode === 'project') {
      return items.filter(item => projectVisibleHrefs.has(item.href));
    }
    return items;
  }

  function render() {
    const selectedCategories = Array.from(filterCheckboxes).filter(cb => cb.checked).map(cb => cb.value);
    const searchTerm = searchInput.value.trim().toLowerCase();

    const filtered = visibleItems.filter(item => {
      if (selectedCategories.length > 0 && !selectedCategories.includes(item.category)) return false;
      if (searchTerm !== '') {
        return item.group.toLowerCase().includes(searchTerm) ||
          item.title.toLowerCase().includes(searchTerm) ||
          (item.desc && item.desc.toLowerCase().includes(searchTerm));
      }
      return true;
    });

    resultSpan.innerText = `${filtered.length} 団体 / ${visibleItems.length} 団体`;

    if (filtered.length === 0) {
      container.innerHTML = '<div class="no-result">該当する団体なし</div>';
      return;
    }

    let html = '';
    for (const item of filtered) {
      html += `
        <div class="item-card">
          <div class="group-name">${item.group}</div>
          <span class="category-badge">${item.category}</span>
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
      visibleItems = getVisibleItems(allItems);

      searchInput.disabled = false;
      filterCheckboxes.forEach(cb => cb.disabled = false);
      selectAllCheckbox.disabled = false;

      render();
    } catch (error) {
      container.innerHTML = `<div class="no-result">❌ ${escapeHtml(error.message)}</div>`;
      resultSpan.innerText = 'エラー';
    }
  }

  filterCheckboxes.forEach(cb => {
    cb.addEventListener('change', function () {
      if (!this.checked) {
        selectAllCheckbox.checked = false;
      } else {
        selectAllCheckbox.checked = Array.from(filterCheckboxes).every(c => c.checked);
      }
      render();
    });
  });

  selectAllCheckbox.addEventListener('change', function () {
    const isChecked = this.checked;
    filterCheckboxes.forEach(cb => cb.checked = isChecked);
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

async function renderTopSlider(selectorContainer, selectorSwiper, categoryFilter) {
  const container = document.querySelector(selectorContainer);
  const swiperEl = document.querySelector(selectorSwiper);
  if (!container || !swiperEl || !container.classList.contains('swiper-wrapper')) return;

  try {
    const items = await fetchItems();
    const filtered = items.filter(item => categoryFilter(item.category));
    await renderSwiperCards({ container, swiperEl, items: filtered });
  } catch (error) {
    container.innerHTML = `<div class="swiper-slide"><div class="no-result">❌ ${escapeHtml(error.message)}</div></div>`;
  }
}

async function renderExhibPlaceholders() {
  const mounts = document.querySelectorAll('[id^="exhib_"]');
  if (!mounts.length) return;

  const items = await fetchItems();
  const byGroup = new Map(items.map(item => [String(item.group), item]));

  for (const mount of mounts) {
    const group = mount.id.slice('exhib_'.length);
    const item = byGroup.get(group);
    
    if (!item) continue;

    // 既にカードが生成されている場合はスキップ
    if (mount.querySelector('.exhib_card')) continue;

    const page = resolveHref(item.href);
    const href = `${page}#${encodeURIComponent(item.group)}`;
    const imageHtml = item.image ? `<img src="${item.image}" class="map" alt="">` : '';

    mount.innerHTML = `
      <a href="${href}">
        <div class="exhib_card">
          <span class="group">${escapeHtml(item.group)}</span>
          ${imageHtml}
          <span class="title">${escapeHtml(item.title)}</span>
          <div class="desc">${escapeHtml(item.desc || '')}</div>
        </div>
      </a>
    `;
  }
}

async function renderDirectExhibCards() {
  try {
    const data = await fetchItems();
    for (let i = 0; i < data.length; i++) {
      const item = data[i] || {};
      const groupName = item.group;
      if (!groupName) continue;

      const mount = document.getElementById('exhib_' + groupName);
      if (!mount) continue;

      // 既にカードが生成されている場合はスキップ
      if (mount.querySelector('.exhib_card')) continue;

      const group = '<span class="group">' + escapeHtml(groupName) + '</span>';
      const title = '<span class="title">' + escapeHtml(item.title || '') + '</span>';
      const desc = '<div class="desc">' + escapeHtml(item.desc || '') + '</div>';
      const image = item.image ? '<img src="' + escapeHtml(item.image) + '" class="map">' : '';
      const card = '<div class="exhib_card">' + group + title + desc + image + '</div>';
      mount.insertAdjacentHTML('beforeend', card);
    }
  } catch (e) {
    console.error(e);
  }
}

function initCountdown() {
  const eventDate = new Date('2026-09-19T09:00:00+09:00');
  const els = {
    days: document.getElementById('days'),
    hours: document.getElementById('hours'),
    minutes: document.getElementById('minutes'),
    seconds: document.getElementById('seconds'),
  };
  if (!els.days || !els.hours || !els.minutes || !els.seconds) return;

  function update() {
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
    }
  }

  update();
  setInterval(update, 1000);
}

function initTemplateInjection() {
  const headerMount = document.querySelector('#header');
  if (headerMount) {
    fetch('template/menu.html').then(r => r.text()).then(html => {
      headerMount.innerHTML = html;
    }).catch(() => {/* ignore */});
  }

  const footerMount = document.querySelector('#footer');
  if (footerMount) {
    fetch('template/footer_template.html').then(r => r.text()).then(html => {
      footerMount.innerHTML = html;
    }).catch(() => {/* ignore */});
  }
}

function initSwipers() {
  if (!window.Swiper) return;
  const commonConfig = {
    slidesPerView: 3,
    spaceBetween: 24,
    centeredSlides: false,
    loop: true,
    breakpoints: {
      0:   { slidesPerView: 1, spaceBetween: 16 },
      600: { slidesPerView: 1, spaceBetween: 20 },
      900: { slidesPerView: 3, spaceBetween: 24 }
    }
  };

  const swiperOptions = [
    { selector: '.class-swiper', delay: 3000 },
    { selector: '.indv-swiper', autoplayDisabled: true }
  ];

  swiperOptions.forEach(opt => {
    document.querySelectorAll(opt.selector).forEach(el => {
      if (el.swiper) return;
      const config = { ...commonConfig };
      if (!opt.autoplayDisabled) {
        config.autoplay = { delay: opt.delay, disableOnInteraction: false };
      }
      config.pagination = { el: el.querySelector('.swiper-pagination'), clickable: true };
      new Swiper(el, config);
    });
  });
}

function initNavHighlight() {
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
}

// --- Main Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
  // 1. 各種UI・コンポーネントの初期化
  initTemplateInjection();
  initCountdown();
  initNavHighlight();

  // 2. データの取得とカードの描画処理
  //    Legacy直接描画とアンカーつき描画の両方を実行
  await Promise.all([
    renderDirectExhibCards(),
    renderExhibPlaceholders(),
    renderTopSlider('#cardsContainer', '.class-swiper', c =>
      c === '中学展示' || c === '高校展示' || c === '部活動' || c === '模擬店'
    )
  ]);

  // 3. コンテンツがDOMに追加されたあとにSwiperとプロジェクトリストを初期化
  initSwipers();
  initProjectList();
});