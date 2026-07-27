/* ============================================================
   归档页：把全部文章按年份分组，时间线式排列
   ============================================================ */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const SITE = window.SITE || {};

  // 归档不管置顶，一律按日期新→旧
  const ALL = (window.ARTICLES || []).slice()
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  function shortDate(iso) {
    const [, m, d] = String(iso || '').split('-');
    if (!m || !d) return iso || '';
    return TW.getLang() === 'zh'
      ? `${+m} 月 ${+d} 日`
      : `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m - 1]} ${+d}`;
  }

  function render() {
    const name = TW.pick(SITE.name) || '唐维西';
    document.title = TW.t('archive_title') + ' · ' + name;
    $('pageTitle').textContent = TW.t('archive_title');
    $('pageSub').textContent = TW.t('archive_count', ALL.length);
    $('backText').textContent = TW.t('back');
    $('navAbout').textContent = TW.t('nav_about');
    $('siteFooter').innerHTML = TW.footerHTML(TW.pick(SITE.footer), 'archive.html');

    if (!ALL.length) {
      $('archive').innerHTML = `<div class="empty-state"><h3>${TW.t('empty_title')}</h3><p>${TW.t('empty_desc')}</p></div>`;
      return;
    }

    // 按年份分组
    const years = [];
    const byYear = {};
    ALL.forEach((a) => {
      const y = String(a.date || '').slice(0, 4) || '—';
      if (!byYear[y]) { byYear[y] = []; years.push(y); }
      byYear[y].push(a);
    });

    $('archive').innerHTML = years.map((y) => `
      <section class="archive-year">
        <h2 class="archive-year-title">${TW.escapeHTML(y)}</h2>
        <div class="archive-list">
          ${byYear[y].map((a) => {
            const isExternal = !!a.externalUrl;
            const href = isExternal ? a.externalUrl : 'article.html?id=' + encodeURIComponent(a.id);
            const target = isExternal ? ' target="_blank" rel="noopener"' : '';
            return `
            <a class="archive-item" href="${TW.escapeHTML(href)}"${target}>
              <span class="archive-date">${TW.escapeHTML(shortDate(a.date))}</span>
              <span class="archive-title">${TW.escapeHTML(TW.pick(a.title))}</span>
              ${(a.tags || []).length ? `<span class="archive-tags">${(a.tags || []).slice(0, 2).map((t) => `<span class="tag">${TW.escapeHTML(t)}</span>`).join('')}</span>` : ''}
            </a>`;
          }).join('')}
        </div>
      </section>`).join('');

    TW.reveal(document.querySelectorAll('.archive-item'), 25);
  }

  TW.initTheme('themeToggle');
  TW.initDock('dock');
  TW.initBackTop();
  TW.initLang('langToggle', render);
})();
