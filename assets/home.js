/* ============================================================
   首页逻辑：渲染卡片、搜索、标签筛选、主题、中英切换
   ============================================================ */
(function () {
  'use strict';

  const SITE = window.SITE || {};
  // 置顶优先，再按日期新→旧（与后台 / 服务端 build 规则一致）
  const ALL = (window.ARTICLES || []).slice().sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return String(b.date || '').localeCompare(String(a.date || ''));
  });

  const $ = (id) => document.getElementById(id);
  const grid = $('grid');

  let activeTag = '__all__';
  let keyword = '';

  /* ------------------------------ 页头渲染 ------------------------------ */
  function renderHeader() {
    const name = TW.pick(SITE.name) || '唐维西';
    $('siteTitle').textContent = name;
    $('siteTagline').textContent = TW.pick(SITE.tagline);
    document.title = name;

    // Logo
    const slot = $('logoSlot');
    const logo = SITE.logo || 'github';
    if (logo === 'none') {
      slot.closest('.hero-avatar').hidden = true;
    } else if (logo === 'github') {
      slot.innerHTML = '<div class="logo-mark">' + TW.icon('github') + '</div>';
    } else if (logo === 'text') {
      slot.innerHTML = '<div class="logo-mark is-text">' + TW.escapeHTML(SITE.logoText || name.charAt(0)) + '</div>';
    } else {
      slot.innerHTML = '<img class="logo-image" src="' + TW.escapeHTML(logo) + '" alt="' + TW.escapeHTML(name) + '">';
    }

    // Dock 里的迷你身份标识：跟着 Hero 的 logo 走，保持前后一致
    $('dockName').textContent = name;
    const mark = $('dockMark');
    if (logo === 'github') mark.innerHTML = TW.icon('github');
    else if (logo === 'text' || logo === 'none') mark.textContent = SITE.logoText || name.charAt(0);
    else mark.innerHTML = '<img src="' + TW.escapeHTML(logo) + '" alt="">';

    // 眉标：最近一次更新是什么时候
    const latest = ALL.map((a) => a.updated || a.date).filter(Boolean).sort().pop();
    $('heroEyebrow').textContent = latest ? TW.t('updated') + ' ' + TW.formatDate(latest) : '';

    // 链接胶囊（支持「打开」或「复制」两种模式）
    const links = SITE.links || [];
    if (links.length) {
      $('linksBar').hidden = false;
      TW.renderSiteLinks($('linksList'), links);
    } else {
      $('linksBar').hidden = true;
    }

    // 导航入口（Dock + 页脚）
    $('navArchive').textContent = TW.t('nav_archive');
    $('navAbout').textContent = TW.t('nav_about');
    $('siteFooter').innerHTML = TW.footerHTML(TW.pick(SITE.footer), 'index.html');
    $('searchInput').placeholder = TW.t('search_placeholder');
    $('fabText').textContent = TW.t('write');
  }

  /* ------------------------------ 标签筛选 ------------------------------ */
  function allTags() {
    const set = new Map();
    ALL.forEach((a) => (a.tags || []).forEach((t) => set.set(t, (set.get(t) || 0) + 1)));
    return [...set.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);
  }

  function renderTagFilters() {
    const tags = allTags();
    const box = $('tagFilters');
    if (!tags.length) { box.innerHTML = ''; return; }
    box.innerHTML =
      `<button class="tag-chip ${activeTag === '__all__' ? 'active' : ''}" data-tag="__all__">${TW.t('all')}</button>` +
      tags.map((t) => `<button class="tag-chip ${activeTag === t ? 'active' : ''}" data-tag="${TW.escapeHTML(t)}">${TW.escapeHTML(t)}</button>`).join('');

    box.querySelectorAll('.tag-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTag = btn.dataset.tag;
        renderTagFilters();
        renderGrid();
      });
    });
  }

  /* --------------------- 全文搜索索引（第一次搜索时才加载） ---------------------
     标题摘要常常想不起来，但正文里的某个词还记得 —— 所以搜索要能搜到正文。
     正文文件是按篇拆开的，逐个加载一次、抽成纯文本缓存住，之后搜索都在内存里。 */
  let FULLTEXT = null;          // Map: id -> 正文纯文本（小写）
  let fulltextLoading = false;

  function ensureFulltext() {
    if (FULLTEXT || fulltextLoading) return;
    fulltextLoading = true;
    const map = new Map();
    const list = ALL.filter((a) => !a.externalUrl);
    // 逐个顺序加载：都用 window.__POST__ 这一个变量传值，并行会互相覆盖
    (function next(i) {
      if (i >= list.length) {
        FULLTEXT = map;
        renderGrid();             // 索引就绪后，把当前搜索结果补全
        return;
      }
      const s = document.createElement('script');
      s.src = 'data/posts/' + encodeURIComponent(list[i].id) + '.js';
      s.onload = () => {
        const p = window.__POST__;
        if (p && p.id === list[i].id) {
          const div = document.createElement('div');
          div.innerHTML = (p.content || '') + ' ' + (p.contentEn || '');
          map.set(p.id, (div.textContent || '').toLowerCase());
        }
        s.remove();
        next(i + 1);
      };
      s.onerror = () => { s.remove(); next(i + 1); };
      document.head.appendChild(s);
    })(0);
  }

  /* ------------------------------ 卡片渲染 ------------------------------ */
  function matches(a) {
    if (activeTag !== '__all__' && (a.tags || []).indexOf(activeTag) === -1) return false;
    if (!keyword) return true;
    const kw = keyword.toLowerCase();
    const hay = [
      TW.pick(a.title), TW.pick(a.summary), (a.tags || []).join(' '), a.date,
    ].join(' ').toLowerCase();
    if (hay.indexOf(kw) !== -1) return true;
    // 元信息没命中就查正文全文
    if (!FULLTEXT) { ensureFulltext(); return false; }
    const body = FULLTEXT.get(a.id);
    return !!body && body.indexOf(kw) !== -1;
  }

  function coverHTML(a) {
    const title = TW.pick(a.title);
    if (a.cover) {
      return `<img src="${TW.escapeHTML(a.cover)}" alt="${TW.escapeHTML(title)}" loading="lazy">`;
    }
    // 没封面就按标题生成一张抽象封面（同一篇文章永远是同一个配色）
    // 只放首字和标签，不重复标题 —— 因为标题就在正下方
    const glyph = title.trim().charAt(0) || '文';
    const label = (a.tags && a.tags[0]) || TW.formatDate(a.date) || '';
    return `<div class="cover-auto" style="${TW.autoCoverStyle(a.id + title)}">
        <span class="cover-glyph">${TW.escapeHTML(glyph)}</span>
        ${label ? `<span class="cover-tagline">${TW.escapeHTML(label)}</span>` : ''}
      </div>`;
  }

  function badgesHTML(a) {
    const out = [];
    if (a.pinned) out.push(`<span class="badge badge-pinned">${TW.t('pinned')}</span>`);
    if (TW.daysSince(a.date) <= 14) out.push(`<span class="badge badge-new">${TW.t('new')}</span>`);
    return out.join('');
  }

  function cardHTML(a, featured) {
    const title = TW.pick(a.title);
    const summary = TW.pick(a.summary);
    const isExternal = !!a.externalUrl;
    const href = isExternal ? a.externalUrl : `article.html?id=${encodeURIComponent(a.id)}`;
    const target = isExternal ? ' target="_blank" rel="noopener"' : '';
    const flag = featured
      ? `<span class="featured-flag">${a.pinned ? TW.t('pinned') : TW.t('latest')}</span>` : '';

    return `
      <a class="card${featured ? ' card--featured' : ''}" href="${TW.escapeHTML(href)}"${target}>
        <div class="card-image-area">${coverHTML(a)}</div>
        <div class="card-content">
          ${flag}
          <div class="card-header">
            <h2 class="card-title">${TW.escapeHTML(title)}</h2>
            <span style="display:flex;gap:6px">${featured ? '' : badgesHTML(a)}</span>
          </div>
          <p class="card-desc">${TW.escapeHTML(summary)}</p>
          <div class="card-date">
            <span>${TW.escapeHTML(TW.formatDate(a.date))}</span>
            <span class="dot">·</span>
            <span>${TW.t('min_read', a.readingTime || 1)}</span>
            ${a.words ? `<span class="dot">·</span><span>${TW.t('words', a.words)}</span>` : ''}
          </div>
          ${(a.tags || []).length ? `<div class="tag-list">${(a.tags || []).map((t) => `<span class="tag">${TW.escapeHTML(t)}</span>`).join('')}</div>` : ''}
        </div>
      </a>`;
  }

  function emptyHTML(isFiltered) {
    const icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2"/></svg>`;
    if (isFiltered) {
      return `<div class="empty-state">${icon}<h3>${TW.t('no_result_title')}</h3><p>${TW.t('no_result_desc')}</p></div>`;
    }
    return `<div class="empty-state">${icon}<h3>${TW.t('empty_title')}</h3><p>${TW.t('empty_desc')}</p></div>`;
  }

  function renderGrid() {
    // 筛选后仍保持：置顶优先 → 日期新→旧
    const list = ALL.filter(matches).sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return String(b.date || '').localeCompare(String(a.date || ''));
    });
    if (!list.length) {
      grid.innerHTML = emptyHTML(ALL.length > 0);
      $('resultCount').textContent = '';
      return;
    }

    // 只有在"没筛选、没搜索"的完整列表里才立头条 ——
    // 一旦用户在找东西，所有结果就该平权排列，不该有一个被放大。
    // 头条优先给置顶文；没有置顶时，第一篇（最新）当头条。
    const isBrowsing = activeTag === '__all__' && !keyword;
    const lead = isBrowsing && list.length >= 2;

    grid.innerHTML = list.map((a, i) => cardHTML(a, lead && i === 0)).join('');
    $('resultCount').textContent = TW.t('count', list.length);

    // 封面图淡入
    grid.querySelectorAll('.card-image-area img').forEach((img) => {
      if (img.complete) img.classList.add('img-loaded');
      else img.addEventListener('load', () => img.classList.add('img-loaded'), { once: true });
    });

    TW.reveal(grid.querySelectorAll('.card'));
  }

  /* ------------------------------ 搜索交互 ------------------------------ */
  function initSearch() {
    const input = $('searchInput');
    const box = $('searchBox');
    let timer;
    input.addEventListener('input', () => {
      box.classList.toggle('has-value', !!input.value);
      clearTimeout(timer);
      timer = setTimeout(() => { keyword = input.value.trim(); renderGrid(); }, 120);
    });
    $('searchClear').addEventListener('click', () => {
      input.value = ''; keyword = '';
      box.classList.remove('has-value');
      renderGrid(); input.focus();
    });
    // 按 / 键快速聚焦搜索框
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== input) {
        e.preventDefault(); input.focus();
      }
      if (e.key === 'Escape' && document.activeElement === input) input.blur();
    });
  }

  /* -------------------------------- 启动 -------------------------------- */
  // 从文章页点标签跳回来时（index.html?tag=xxx），自动选中那个标签
  const urlTag = new URLSearchParams(location.search).get('tag');
  if (urlTag) activeTag = urlTag;

  // JSON-LD：告诉搜索引擎这是个什么网站
  if (SITE.url) {
    const ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: TW.pick(SITE.name) || '唐维西',
      description: TW.pick(SITE.tagline) || undefined,
      url: String(SITE.url).replace(/\/+$/, '') + '/',
    });
    document.head.appendChild(ld);
  }

  TW.initTheme('themeToggle');
  TW.initLang('langToggle', () => { renderHeader(); renderTagFilters(); renderGrid(); });
  if (TW.isLocal()) document.body.classList.add('is-local');
  TW.initDock('dock');
  TW.initBackTop();
  TW.initSticky('toolbarSentinel', 'toolbar');
  initSearch();
  renderHeader();
  renderTagFilters();
  renderGrid();
})();
