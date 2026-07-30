/* ============================================================
   公共工具库 —— 首页 / 文章页 / 后台 三个页面共用
   全部挂在 window.TW 上，方便调用，比如 TW.readingTime('...')
   ============================================================ */
window.TW = (function () {
  'use strict';

  /* ---------------------------- 界面文案（中英） ---------------------------- */
  const I18N = {
    zh: {
      search_placeholder: '搜索文章（标题、标签、正文全文）…',
      all: '全部',
      count: (n) => `共 ${n} 篇文章`,
      no_result_title: '没有找到相关文章',
      no_result_desc: '换个关键词试试，或者点“全部”看看所有文章。',
      empty_title: '还没有文章',
      empty_desc: '点右下角的「写文章」按钮开始写第一篇吧。',
      write: '写文章',
      back: '返回首页',
      min_read: (n) => `约 ${n} 分钟读完`,
      words: (n) => `${n} 字`,
      updated: '更新于',
      toc: '本文目录',
      related: '相关阅读',
      prev: '上一篇',
      next: '下一篇',
      new: 'NEW',
      latest: '最新',
      pinned: '置顶',
      draft: '草稿',
      links_title: 'Links',
      copy_code: '复制',
      copied: '已复制',
      not_found: '这篇文章不存在，可能已被删除。',
      nav_archive: '归档',
      nav_about: '关于',
      about_title: '关于我',
      about_empty_local: '这一页还是空的 —— 去后台点「关于页」，写几句介绍自己吧。',
      about_empty: '这里还没有内容。',
      archive_title: '归档',
      archive_count: (n) => `共 ${n} 篇`,
      rss: 'RSS 订阅',
      nav_links: '友链',
      friends_sub: '都是些有意思的人。',
      friends_empty_title: '还没有友链',
      friends_empty_local: '去后台「网站设置」最底下，把朋友们的网站加进来吧。',
      friends_empty: '这里还没有内容。',
      back_top: '回到顶部',
      share: '分享',
      copy_link: '复制链接',
      link_copied: '链接已复制',
      copied_value: '已复制',
      copy_hint: '点击复制',
    },
    en: {
      search_placeholder: 'Search articles (full text)…',
      all: 'All',
      count: (n) => `${n} article${n === 1 ? '' : 's'}`,
      no_result_title: 'Nothing found',
      no_result_desc: 'Try another keyword, or click “All” to see everything.',
      empty_title: 'No articles yet',
      empty_desc: 'Click the “Write” button at the bottom right to start.',
      write: 'Write',
      back: 'Back to home',
      min_read: (n) => `${n} min read`,
      words: (n) => `${n} words`,
      updated: 'Updated',
      toc: 'On this page',
      related: 'Related reading',
      prev: 'Previous',
      next: 'Next',
      new: 'NEW',
      latest: 'Latest',
      pinned: 'Pinned',
      draft: 'Draft',
      links_title: 'Links',
      copy_code: 'Copy',
      copied: 'Copied',
      not_found: 'This article does not exist. It may have been deleted.',
      nav_archive: 'Archive',
      nav_about: 'About',
      about_title: 'About me',
      about_empty_local: 'This page is empty — open the admin and click “About page” to introduce yourself.',
      about_empty: 'Nothing here yet.',
      archive_title: 'Archive',
      archive_count: (n) => `${n} article${n === 1 ? '' : 's'}`,
      rss: 'RSS',
      nav_links: 'Friends',
      friends_sub: 'Interesting people I know.',
      friends_empty_title: 'No links yet',
      friends_empty_local: 'Open Site Settings in the admin to add your friends’ sites.',
      friends_empty: 'Nothing here yet.',
      back_top: 'Back to top',
      share: 'Share',
      copy_link: 'Copy link',
      link_copied: 'Link copied',
      copied_value: 'Copied',
      copy_hint: 'Click to copy',
    },
  };

  let lang = 'zh';

  function t(key, arg) {
    const v = (I18N[lang] || I18N.zh)[key];
    return typeof v === 'function' ? v(arg) : v == null ? key : v;
  }

  /* ------------------------------- 主题切换 ------------------------------- */
  function applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }

  function initTheme(buttonId) {
    const saved = localStorage.getItem('tw-theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved || (prefersDark ? 'dark' : 'light'));

    // 用户没手动选过时，跟随系统设置变化
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = (e) => {
        if (!localStorage.getItem('tw-theme')) applyTheme(e.matches ? 'dark' : 'light');
      };
      mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange);
    }

    const btn = document.getElementById(buttonId);
    if (btn) {
      btn.addEventListener('click', () => {
        const next = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        localStorage.setItem('tw-theme', next);
      });
    }
  }

  /* ------------------------------- 语言切换 ------------------------------- */
  function initLang(buttonId, onChange) {
    lang = localStorage.getItem('tw-lang') || 'zh';
    const btn = document.getElementById(buttonId);
    const paint = () => {
      document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
      if (btn) btn.textContent = lang === 'zh' ? 'En' : '中';
      if (onChange) onChange(lang);
    };
    if (btn) {
      btn.addEventListener('click', () => {
        lang = lang === 'zh' ? 'en' : 'zh';
        localStorage.setItem('tw-lang', lang);
        paint();
      });
    }
    paint();
    return lang;
  }

  function getLang() { return lang; }

  /** 取双语字段：{zh:'…', en:'…'} 或纯字符串都能处理，英文缺失时自动回落中文 */
  function pick(field) {
    if (field == null) return '';
    if (typeof field === 'string') return field;
    return field[lang] || field.zh || field.en || '';
  }

  /* ------------------------------ 日期与阅读 ------------------------------ */
  function today() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function formatDate(iso) {
    if (!iso) return '';
    const [y, m, d] = String(iso).split('-');
    if (!y || !m || !d) return iso;
    return lang === 'zh' ? `${y} 年 ${+m} 月 ${+d} 日` : `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m - 1]} ${+d}, ${y}`;
  }

  function daysSince(iso) {
    if (!iso) return Infinity;
    const then = new Date(iso + 'T00:00:00');
    if (isNaN(then)) return Infinity;
    return Math.floor((Date.now() - then.getTime()) / 86400000);
  }

  /** 统计字数：中文按字算，英文按词算 */
  function countWords(text) {
    const s = String(text || '');
    const cjk = (s.match(/[一-龥぀-ヿ]/g) || []).length;
    const en = (s.replace(/[一-龥぀-ヿ]/g, ' ').match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g) || []).length;
    return cjk + en;
  }

  /**
   * 估算阅读时间（分钟）
   * 中文成年人默认 400 字/分钟；每张图片按 12 秒计；代码块读得慢，额外加权。
   */
  function readingTime(html) {
    const div = document.createElement('div');
    div.innerHTML = html || '';
    const imgs = div.querySelectorAll('img').length;
    let codeChars = 0;
    div.querySelectorAll('pre').forEach((p) => { codeChars += (p.textContent || '').length; });
    const words = countWords(div.textContent || '');
    const minutes = words / 400 + imgs * 0.2 + codeChars / 500;
    return Math.max(1, Math.round(minutes));
  }

  /** 从正文自动提取摘要 */
  function autoSummary(html, max) {
    const div = document.createElement('div');
    div.innerHTML = html || '';
    div.querySelectorAll('pre, figure, .toc').forEach((n) => n.remove());
    const text = (div.textContent || '').replace(/\s+/g, ' ').trim();
    const limit = max || 90;
    return text.length > limit ? text.slice(0, limit) + '…' : text;
  }

  /* ---------------------------- 自动生成封面 ---------------------------- */
  const GRADIENTS = [
    ['#667eea', '#764ba2'], ['#f093fb', '#f5576c'], ['#4facfe', '#00f2fe'],
    ['#43e97b', '#38f9d7'], ['#fa709a', '#fee140'], ['#30cfd0', '#330867'],
    ['#a8edea', '#5b7cfa'], ['#ff9a9e', '#fecfef'], ['#0ba360', '#3cba92'],
    ['#f6d365', '#fda085'], ['#5ee7df', '#b490ca'], ['#2af598', '#009efd'],
    ['#e96443', '#904e95'], ['#1e3c72', '#2a5298'], ['#c471f5', '#fa71cd'],
  ];

  function hashOf(str) {
    let h = 0;
    for (let i = 0; i < String(str).length; i++) h = (h * 31 + String(str).charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function autoCoverStyle(seed) {
    const [a, b] = GRADIENTS[hashOf(seed) % GRADIENTS.length];
    const angle = 110 + (hashOf(seed + 'x') % 5) * 15;
    return `background: linear-gradient(${angle}deg, ${a}, ${b});`;
  }

  /* ------------------------------- 小工具 ------------------------------- */
  function escapeHTML(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function newId() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `p${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${Math.random().toString(36).slice(2, 7)}`;
  }

  /** 本地运行？（决定要不要显示“写文章”按钮） */
  function isLocal() {
    return ['localhost', '127.0.0.1', ''].indexOf(location.hostname) !== -1;
  }

  /* -------------------------------- 图标 -------------------------------- */
  const ICONS = {
    github: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>',
    wechat: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.7 3C4.9 3 1.8 5.6 1.8 8.8c0 1.8 1 3.5 2.6 4.6l-.7 2 2.3-1.2c.8.2 1.5.4 2.3.4h.6a5.3 5.3 0 0 1-.2-1.5c0-3.1 3-5.6 6.7-5.6h.6C15.4 4.9 12.4 3 8.7 3M6.4 7.5a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8m4.6 0a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8"/><path d="M22.2 13.1c0-2.7-2.7-4.9-5.9-4.9s-5.9 2.2-5.9 4.9 2.7 4.9 5.9 4.9c.7 0 1.3-.1 2-.3l1.9 1-.5-1.7c1.5-1 2.5-2.4 2.5-3.9m-7.8-.9a.7.7 0 1 1 0-1.5.7.7 0 0 1 0 1.5m3.8 0a.7.7 0 1 1 0-1.5.7.7 0 0 1 0 1.5"/></svg>',
    bilibili: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.2 3.4c.5.5.5 1.3 0 1.8l-1 1h1.5A3.3 3.3 0 0 1 22 9.5v8a3.3 3.3 0 0 1-3.3 3.3H5.3A3.3 3.3 0 0 1 2 17.5v-8a3.3 3.3 0 0 1 3.3-3.3h1.5l-1-1a1.3 1.3 0 1 1 1.8-1.8l2.5 2.5.1.3h3.6l.1-.3 2.5-2.5c.5-.5 1.3-.5 1.8 0M18.7 8.7H5.3c-.4 0-.8.4-.8.8v8c0 .4.4.8.8.8h13.4c.4 0 .8-.4.8-.8v-8c0-.4-.4-.8-.8-.8M8.3 11.2c.6 0 1.1.5 1.1 1.1v1.3a1.1 1.1 0 1 1-2.2 0v-1.3c0-.6.5-1.1 1.1-1.1m7.4 0c.6 0 1.1.5 1.1 1.1v1.3a1.1 1.1 0 1 1-2.2 0v-1.3c0-.6.5-1.1 1.1-1.1"/></svg>',
    zhihu: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.1 4.6H8.5l.7-2h4.6l-.7 2M11.3 8.4c-.2 2.3-.6 4.2-1.3 5.9l1.6 1.7-1.3 1.3-1.2-1.3c-.7 1.2-1.6 2.3-2.7 3.2l-.9-1.5c1.9-1.8 3-4.5 3.3-8v-1.3H6.2l-.7 2H4L5.5 6h5.8v2.4zm10.6 8.5h-3.6l-3 3.3-.9-1.5 1.6-1.8h-2.6V8.4h2c.2-.7.4-1.5.5-2.3h-2.3V4.6h6.9v1.5h-2.9c-.2.8-.3 1.6-.5 2.3h3v8.5h-.2zm-1.6-6.9h-3.4v5.4h3.4V10z"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-6.5L6.3 22H3.2l7.3-8.3L2.5 2h6.4l4.5 5.9zm-1.1 18.1h1.7L7.9 3.8H6z"/></svg>',
    xiaohongshu: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 4h18a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1m3.4 5v6h1.4v-2.2h.6l1 2.2h1.6l-1.2-2.5c.6-.3 1-.9 1-1.6 0-1.1-.8-1.9-2-1.9zm1.4 1.2h.9c.5 0 .8.3.8.7s-.3.7-.8.7h-.9zM13 9v6h3.9v-1.3h-2.5v-1.2h2.2v-1.2h-2.2v-1h2.4V9z"/></svg>',
    rss: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1.5" fill="currentColor"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2"/></svg>',
  };

  function icon(name) { return ICONS[name] || ICONS.link; }

  /** 轻提示（前台页面也能用，不依赖后台 toast） */
  function toast(msg, isError) {
    let el = document.getElementById('tw-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'tw-toast';
      el.className = 'tw-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg || '';
    el.classList.toggle('is-error', !!isError);
    el.classList.add('is-show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('is-show'), 1800);
  }

  function copyText(text) {
    const v = String(text || '');
    if (!v) return Promise.reject(new Error('empty'));
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(v);
    }
    return new Promise((resolve, reject) => {
      try {
        const ta = document.createElement('textarea');
        ta.value = v;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;left:-9999px;top:0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error('copy failed'));
      } catch (e) { reject(e); }
    });
  }

  /** 判断一条社交链接是「打开网页」还是「复制内容」 */
  function linkAction(l) {
    if (l && (l.action === 'copy' || l.action === 'open')) return l.action;
    // 兼容旧数据：没有 action 时，邮箱 / 微信号等不像网址的默认复制
    const u = String((l && l.url) || '').trim();
    if (!u) return 'open';
    if (/^(https?:|mailto:|tel:)/i.test(u)) return 'open';
    if (l && (l.icon === 'mail' || l.icon === 'wechat')) return 'copy';
    if (u.indexOf('@') !== -1 && u.indexOf(' ') === -1) return 'copy';
    return 'open';
  }

  function linkHref(l) {
    const u = String((l && l.url) || '').trim();
    if (!u) return '#';
    if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
    if ((l && l.icon === 'mail') || (u.indexOf('@') !== -1 && u.indexOf('/') === -1)) {
      return 'mailto:' + u.replace(/^mailto:/i, '');
    }
    if (/^[\w.-]+\.[\w.-]+/.test(u) && u.indexOf(' ') === -1) return 'https://' + u;
    return u;
  }

  /**
   * 站点正式网址（用于 canonical / JSON-LD / 分享）。
   * 后台只填域名时自动补 https://；已有协议则原样保留；空则返回 ''。
   */
  function siteBase(raw) {
    let u = String(raw != null ? raw : ((window.SITE && window.SITE.url) || '')).trim();
    if (!u) return '';
    u = u.replace(/[\u3000\s]+/g, '').replace(/\/+$/, '');
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) {
      try {
        const parsed = new URL(u);
        const path = parsed.pathname.replace(/\/+$/, '');
        return (parsed.origin + (path && path !== '/' ? path : '')).replace(/\/+$/, '');
      } catch (e) {
        return u.replace(/\/+$/, '');
      }
    }
    if (/^\/\//.test(u)) return siteBase('https:' + u);
    if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?::\d+)?(?:\/.*)?$/i.test(u) ||
        /^localhost(?::\d+)?(?:\/.*)?$/i.test(u) ||
        /^\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?(?:\/.*)?$/.test(u)) {
      return siteBase('https://' + u);
    }
    return u;
  }

  /** 渲染一条社交链接的 HTML（首页 / 关于页共用） */
  function siteLinkItemHTML(l) {
    const name = pick(l.name) || '';
    const action = linkAction(l);
    const isCopy = action === 'copy';
    const href = isCopy ? '#' : escapeHTML(linkHref(l));
    const extra = isCopy
      ? ` href="#" role="button" data-copy="${escapeHTML(String(l.url || ''))}" title="${escapeHTML(t('copy_hint'))}"`
      : ` href="${href}" target="_blank" rel="noopener"`;
    return `
      <li class="links-bar-item${isCopy ? ' is-copy' : ''}">
        <a${extra}>
          <span class="links-bar-icon" style="background:${escapeHTML(l.color || '#334155')}">${icon(l.icon)}</span>
          <span class="links-bar-name">${escapeHTML(name)}</span>
        </a>
      </li>`;
  }

  function renderSiteLinks(listEl, links) {
    if (!listEl) return;
    const arr = links || [];
    listEl.innerHTML = arr.map(siteLinkItemHTML).join('');
    listEl.querySelectorAll('a[data-copy]').forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const text = a.getAttribute('data-copy') || '';
        copyText(text).then(() => {
          toast(t('copied_value') + '：' + text);
        }).catch(() => {
          // 剪贴板被拒时退回手动选择
          window.prompt(t('copy_hint'), text);
        });
      });
    });
  }

  /* ============================================================
     界面行为 —— Dock / 吸顶 / 入场
     ============================================================ */

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /** 滚动监听：合并到一帧里做，避免每个 scroll 事件都读一次布局 */
  function onScrollFrame(fn) {
    let ticking = false;
    const run = () => { ticking = false; fn(); };
    const handler = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(run);
    };
    window.addEventListener('scroll', handler, { passive: true });
    window.addEventListener('resize', handler, { passive: true });
    fn();
    return handler;
  }

  /**
   * 顶部 Dock：页面在最上方时它是透明的、不打扰；
   * 一旦开始滚动，就收窄并"凝结"成一块玻璃胶囊。
   */
  function initDock(dockId) {
    const dock = document.getElementById(dockId || 'dock');
    if (!dock) return;
    onScrollFrame(() => {
      const y = window.scrollY;
      dock.classList.toggle('is-condensed', y > 20);
      // 标题要等页面顶部的大标题真的滚走了才补上，否则同一句话会出现两次
      dock.classList.toggle('is-deep', y > 150);
    });
  }

  /**
   * 吸顶筛选条：用哨兵元素判断是否已经贴住 Dock 下沿，
   * 贴住时才上材质 —— 浮动 UI 真正压住内容的时候才需要分隔。
   */
  function initSticky(sentinelId, targetId) {
    const sentinel = document.getElementById(sentinelId);
    const target = document.getElementById(targetId);
    if (!sentinel || !target || !window.IntersectionObserver) return;
    const gap = parseInt(getComputedStyle(target).top, 10) || 78;
    new IntersectionObserver(
      ([e]) => target.classList.toggle('is-stuck', !e.isIntersecting),
      { rootMargin: `-${gap + 1}px 0px 0px 0px`, threshold: 0 }
    ).observe(sentinel);
  }

  /**
   * 入场揭示：元素进入视口才播，同一屏内按顺序错开，
   * 但错开量有上限，免得最后一张卡等太久。
   */
  function reveal(nodes, step) {
    const list = [].slice.call(nodes);
    if (!list.length) return;
    if (!window.IntersectionObserver) {
      list.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const delayStep = prefersReducedMotion() ? 0 : (step == null ? 55 : step);
    let shown = 0;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.style.setProperty('--reveal-delay', Math.min(shown++, 6) * delayStep + 'ms');
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
    list.forEach((el) => io.observe(el));

    // 兜底：入场动画只是锦上添花，绝不能因为它没触发就让文章看不见
    setTimeout(() => {
      list.forEach((el) => {
        if (!el.classList.contains('is-in') && el.getBoundingClientRect().top < window.innerHeight) {
          el.classList.add('is-in');
        }
      });
    }, 1200);
  }

  /** 页脚：导航 + 版权，所有页面共用同一份 */
  function footerHTML(footerText, currentPage) {
    const items = [
      ['about.html', t('nav_about')],
      ['archive.html', t('nav_archive')],
      ['links.html', t('nav_links')],
      ['feed.xml', t('rss')],
    ].filter(([href]) => href !== currentPage);
    return `
      <nav class="footer-nav">${items.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')}</nav>
      <div>${escapeHTML(footerText || '')}</div>`;
  }

  /**
   * 回到顶部按钮：滚过一屏半才出现，不跟内容抢注意力。
   * 各页面自己调用一次即可，按钮由这里统一创建。
   */
  function initBackTop() {
    const btn = document.createElement('button');
    btn.className = 'back-top';
    btn.type = 'button';
    btn.setAttribute('aria-label', t('back_top'));
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>';
    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    });
    document.body.appendChild(btn);
    onScrollFrame(() => {
      btn.classList.toggle('is-visible', window.scrollY > window.innerHeight * 1.5);
    });
  }

  return {
    I18N, t, getLang, pick,
    initTheme, initLang, applyTheme,
    today, formatDate, daysSince,
    countWords, readingTime, autoSummary,
    autoCoverStyle, hashOf,
    escapeHTML, newId, isLocal, icon, ICONS,
    toast, copyText, linkAction, linkHref, siteBase, siteLinkItemHTML, renderSiteLinks,
    initDock, initSticky, initBackTop, footerHTML, reveal, onScrollFrame, prefersReducedMotion,
  };
})();
