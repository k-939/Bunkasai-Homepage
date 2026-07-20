// --- Utilities & Shared Data ---
const DATA_URL = new URL('assets/data.json', document.baseURI).toString();
const categoryMap = {
  'J.html': '中学展示',
  'S.html': '高校展示',
  'C.html': '部活動展示',
  'V.html': '有志展示',
  'F.html': '模擬店',
  'B.html': '有志演奏',
  'St.html': '講堂舞台企画',
  'CS.html': '部活舞台企画',
  'ngt.html': "Nanzan's Got Talent"
};

const projectVisibleHrefs = new Set(['F.html', 'B.html', 'St.html', 'CS.html', 'ngt.html']);
const projectExhibVisibleHrefs = new Set(['J.html', 'S.html', 'C.html', 'V.html']);
const projectExhibCategoryGroups = {
  '部活動': new Set(['部活動展示', '有志展示'])
};

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

function formatEventTime(item) {
  if (Array.isArray(item.timeSlots) && item.timeSlots.length > 0) {
    const slotLines = item.timeSlots.map(slot => {
      const dateObj = new Date(slot.startTime);
      const month = dateObj.getMonth() + 1;
      const day = dateObj.getDate();
      const start = new Date(slot.startTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
      const end = new Date(slot.endTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
      return `${month}/${day} ${start} 〜 ${end}`;
    }).join(' / ');
    return `<div class="event-time">公演: ${escapeHtml(slotLines)}</div>`;
  }

  if (item.startTime && item.endTime) {
    const dateObj = new Date(item.startTime);
    const month = dateObj.getMonth() + 1;
    const day = dateObj.getDate();
    const start = new Date(item.startTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    const end = new Date(item.endTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    return `<div class="event-time">公演: ${month}/${day} ${start} 〜 ${end}</div>`;
  }

  return '';
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

function renderSingleCard(container, item) {
  const page = resolveHref(item.href);
  const href = `${page}#${encodeURIComponent(item.group)}`;
  const imageHtml = item.image ? `<img src="${item.image}" class="map" alt="">` : '';
  const timeHtml = formatEventTime(item);

  container.innerHTML = `
    <div class="exhib_card_wrapper" style="width: 100%; max-width: 500px; margin: 0 auto;">
      <a href="">
        <div class="exhib_card">
          <div class="group-name">${escapeHtml(item.group)}</div>
          <span class="category-badge">${escapeHtml(item.category)}</span>
          <div class="event-name">「${escapeHtml(item.title)}」</div>
          ${timeHtml}
          <div class="description">${escapeHtml(item.desc || '')}</div>
          <label class="button" for="popupFlag${item.group}">▶︎ 地図を見る</label>
        </div>
      </a>
      <input type="checkbox" class="popup-flag" id="popupFlag${item.group}">
      <label class="popup-background" for="popupFlag${item.group}"></label>
      <div class="popup">
        <label class="close-button" for="popupFlag${item.group}">×</label>
        <div class="content">
          <div>${imageHtml}</div>
        </div>
      </div>
    </div>
  `;
}

// 💡 変更点: 現在時刻に応じて過去の舞台企画を自動除外する
async function initRandomPickup(selectorContainer, categoryFilter) {
  const container = document.querySelector(selectorContainer);
  if (!container) return;

  try {
    const allItems = await fetchItems();

    function updatePickup() {
      // 基準となる現在時刻を取得
      let now = new Date();

      // 【💡開発・テスト用の裏技】
      // もし文化祭当日（2026-09-19）以外に動作確認したい場合は、
      // 下の行のコメントアウトを解除すると、擬似的に「当日11:15」の状態でテストできます。
      // now = new Date('2026-09-19T11:15:00+09:00');

      // 1. まず基本的なカテゴリ（展示や模擬店など）でフィルター
      let filteredItems = allItems.filter(item => categoryFilter(item.category));

      // 2. 時間による条件分岐フィルター（終了した舞台企画を弾く）
      filteredItems = filteredItems.filter(item => {
        // timeSlots（複数回公演）がある場合は、最後のスロットの終了時刻で判定する
        if (Array.isArray(item.timeSlots) && item.timeSlots.length > 0) {
          const lastSlot = item.timeSlots[item.timeSlots.length - 1];
          return now < new Date(lastSlot.endTime);
        }
        // 旧来の endTime が設定されている場合は、それで判定する
        if (item.endTime) {
          const endTime = new Date(item.endTime);
          // 現在時刻が終了時刻を「過ぎていたら」不採用(false)、まだなら採用(true)
          return now < endTime;
        }
        // どちらもない一般展示（教室展示など）はいつでも表示対象にする
        return true;
      });

      if (filteredItems.length === 0) {
        container.innerHTML = '<div class="no-result">現在、表示可能な企画はありません</div>';
        return;
      }

      // 3. 残った有効な企画の中からランダムに3つ選ぶ
      const shuffled = [...filteredItems].sort(() => Math.random() - 0.5);

      const div1 = document.createElement('div');
      div1.classList.add('div1');
      const div2 = document.createElement('div');
      div2.classList.add('div2');
      const div3 = document.createElement('div');
      div3.classList.add('div3');
      container.innerHTML = '';
      container.appendChild(div1);
      container.appendChild(div2);
      container.appendChild(div3);

      renderSingleCard(div1, shuffled[0]);
      renderSingleCard(div2, shuffled[1]);
      renderSingleCard(div3, shuffled[2]);
    }


    updatePickup();
    setInterval(updatePickup, 30000);

  } catch (error) {
    container.innerHTML = `<div class="no-result">❌ ${escapeHtml(error.message)}</div>`;
  }
}

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
      if (selectedCategories.length > 0) {
        const matchesSelectedCategory = selectedCategories.some(category =>
          category === item.category || projectExhibCategoryGroups[category]?.has(item.category)
        );
        if (!matchesSelectedCategory) return false;
      }
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
      const timeHtml = formatEventTime(item);
      html += `
        <div class="item-card">
          <div class="group-name">${item.group}</div>
          <span class="category-badge">${item.category}</span>
          <div class="event-name">「${item.title}」</div>
          ${timeHtml}
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

async function renderExhibPlaceholders() {
  const mounts = document.querySelectorAll('[id^="exhib_"]');
  if (!mounts.length) return;

  const items = await fetchItems();
  const byGroup = new Map(items.map(item => [String(item.group), item]));

  for (const mount of mounts) {
    const group = mount.id.slice('exhib_'.length);
    const item = byGroup.get(group);

    if (!item) continue;
    if (mount.querySelector('.exhib_card')) continue;

    const page = resolveHref(item.href);
    const href = `${page}#${encodeURIComponent(item.group)}`;
    const imageHtml = item.image ? `<img src="${item.image}" class="map" alt="">` : '';

    mount.innerHTML = `
      <a href="">
        <div class="exhib_card">
          <span class="group">${escapeHtml(item.group)}</span>
          <label class="button" for="popupFlag${item.group}">▶︎ 地図を見る</label>
           <input type="checkbox" class="popup-flag" id="popupFlag${item.group}">
           <label class="popup-background" for="popupFlag${item.group}"></label>
           <div class="popup">
            <label class="close-button" for="popupFlag${item.group}">×</label>
              <div class="content">
                <div>${imageHtml}</div>
              </div>
           </div>
          <span class="title">${escapeHtml(item.title)}</span>
          <div class="desc">${escapeHtml(item.desc || '')}</div>
        </div>
      </a>
      <input type="checkbox" class="popup-flag" id="popupFlag${item.group}">
      <label class="popup-background" for="popupFlag${item.group}"></label>
      <div class="popup">
        <label class="close-button" for="popupFlag${item.group}">×</label>
        <div class="content">
          <div>${imageHtml}</div>
        </div>
      </div>
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
  const eventDate = new Date('2026-09-19T09:30:00+09:00');
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
    fetch('../../template/menu.html').then(r => r.text()).then(html => {
      headerMount.innerHTML = html;
    }).catch(() => {/* ignore */ });
  }

  const footerMount = document.querySelector('#footer');
  if (footerMount) {
    fetch('../../template/footer_template.html').then(r => r.text()).then(html => {
      footerMount.innerHTML = html;
    }).catch(() => {/* ignore */ });
  }
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
  initTemplateInjection();
  initCountdown();
  initNavHighlight();

  const pathname = location.pathname.toLowerCase();
  const isIndex = pathname.endsWith('/index.html') || pathname.endsWith('/') || pathname === '';

  await Promise.all([
    renderDirectExhibCards(),
    renderExhibPlaceholders(),
    // 💡 index.htmlのみランダムピックアップを実行
    isIndex ? initRandomPickup('#cardsContainer', c =>
      c === '中学展示' || c === '高校展示' || c === '部活動' || c === '模擬店' || c === '有志演奏' || c === '講堂舞台企画' || c === '部活舞台企画'
    ) : Promise.resolve()
  ]);

  initProjectList();
});
