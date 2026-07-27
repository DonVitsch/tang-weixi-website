/* ============================================================
   关于页：头像 + 简介 + 社交链接 + 正文（正文在后台「关于页」里编辑）
   ============================================================ */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const SITE = window.SITE || {};

  function render() {
    const name = TW.pick(SITE.name) || '唐维西';
    document.title = TW.t('about_title') + ' · ' + name;
    $('backText').textContent = TW.t('back');
    $('navArchive').textContent = TW.t('nav_archive');
    $('pageTitle').textContent = name;
    $('pageSub').textContent = TW.pick(SITE.tagline) || '';
    $('siteFooter').innerHTML = TW.footerHTML(TW.pick(SITE.footer), 'about.html');

    // 头像：跟首页 Logo 用同一套设置
    const avatar = $('aboutAvatar');
    const logo = SITE.logo || 'github';
    if (logo === 'none') avatar.hidden = true;
    else if (logo === 'github') avatar.innerHTML = '<div class="logo-mark">' + TW.icon('github') + '</div>';
    else if (logo === 'text') avatar.innerHTML = '<div class="logo-mark is-text">' + TW.escapeHTML(SITE.logoText || name.charAt(0)) + '</div>';
    else avatar.innerHTML = '<img class="logo-image" src="' + TW.escapeHTML(logo) + '" alt="' + TW.escapeHTML(name) + '">';

    // 社交链接
    const links = SITE.links || [];
    $('aboutLinks').innerHTML = links.map((l) => `
      <li class="links-bar-item">
        <a href="${TW.escapeHTML(l.url)}" target="_blank" rel="noopener">
          <span class="links-bar-icon" style="background:${TW.escapeHTML(l.color || '#334155')}">${TW.icon(l.icon)}</span>
          <span class="links-bar-name">${TW.escapeHTML(TW.pick(l.name))}</span>
        </a>
      </li>`).join('');

    // 正文
    const about = TW.pick(SITE.about);
    if (about) {
      $('aboutProse').innerHTML = about;
    } else {
      $('aboutProse').innerHTML = '<p style="color:var(--text-tertiary)">'
        + TW.escapeHTML(TW.isLocal() ? TW.t('about_empty_local') : TW.t('about_empty')) + '</p>';
    }
  }

  TW.initTheme('themeToggle');
  TW.initDock('dock');
  TW.initBackTop();
  TW.initLang('langToggle', render);
})();
