/* ============================================================
   友链页：展示朋友们的网站（在后台「网站设置」里编辑）
   ============================================================ */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const SITE = window.SITE || {};

  function render() {
    const name = TW.pick(SITE.name) || '唐维西';
    document.title = TW.t('nav_links') + ' · ' + name;
    $('pageTitle').textContent = TW.t('nav_links');
    $('backText').textContent = TW.t('back');
    $('navArchive').textContent = TW.t('nav_archive');
    $('navAbout').textContent = TW.t('nav_about');
    $('siteFooter').innerHTML = TW.footerHTML(TW.pick(SITE.footer), 'links.html');

    const friends = SITE.friends || [];
    $('pageSub').textContent = friends.length ? TW.t('friends_sub') : '';

    if (!friends.length) {
      $('friends').innerHTML = '<div class="empty-state"><h3>' + TW.t('friends_empty_title') + '</h3><p>'
        + TW.escapeHTML(TW.isLocal() ? TW.t('friends_empty_local') : TW.t('friends_empty')) + '</p></div>';
      return;
    }

    $('friends').innerHTML = friends.map((f) => {
      // 头像：传了图用图，没传就用站点首字母 + 按名字生成的固定渐变色
      const avatar = f.avatar
        ? `<img class="friend-avatar" src="${TW.escapeHTML(f.avatar)}" alt="" loading="lazy">`
        : `<span class="friend-avatar friend-avatar--auto" style="${TW.autoCoverStyle(f.name + f.url)}">${TW.escapeHTML((f.name || 'friend').trim().charAt(0))}</span>`;
      return `
      <a class="friend-card" href="${TW.escapeHTML(f.url)}" target="_blank" rel="noopener">
        ${avatar}
        <span class="friend-text">
          <span class="friend-name">${TW.escapeHTML(f.name || '')}</span>
          ${f.desc ? `<span class="friend-desc">${TW.escapeHTML(f.desc)}</span>` : ''}
        </span>
      </a>`;
    }).join('');

    TW.reveal(document.querySelectorAll('.friend-card'), 35);
  }

  TW.initTheme('themeToggle');
  TW.initDock('dock');
  TW.initBackTop();
  TW.initLang('langToggle', render);
})();
