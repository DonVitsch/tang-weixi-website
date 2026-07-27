/* ============================================================
   文章阅读页：加载正文、生成目录、阅读进度、上下篇
   ============================================================ */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const LIST = window.ARTICLES || [];
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const isPreview = params.get('preview') === '1';

  TW.initTheme('themeToggle');
  TW.initDock('dock');
  TW.initBackTop();

  /* --------------------- 用 <script> 加载正文（file:// 也能用） --------------------- */
  function loadPost(pid) {
    // 后台的「预览」：直接读编辑器塞过来的未保存版本，不碰已发布的内容
    if (isPreview) {
      try {
        const p = JSON.parse(localStorage.getItem('tw-preview') || 'null');
        if (p && p.id === pid && p.a) return Promise.resolve(p.a);
      } catch (e) { /* 拿不到就按正常流程加载 */ }
    }
    return new Promise((resolve, reject) => {
      if (!pid) return reject(new Error('缺少文章编号'));
      const s = document.createElement('script');
      s.src = 'data/posts/' + encodeURIComponent(pid) + '.js?v=' + (window.__BUST || Date.now());
      s.onload = () => (window.__POST__ ? resolve(window.__POST__) : reject(new Error('文章内容为空')));
      s.onerror = () => reject(new Error('找不到这篇文章'));
      document.head.appendChild(s);
    });
  }

  /* ------------------------------- 渲染 ------------------------------- */
  function render(post) {
    const title = TW.pick(post.title);
    const summary = TW.pick(post.summary);
    const content = TW.getLang() === 'en' && post.contentEn ? post.contentEn : post.content;

    document.title = title + ' · ' + (TW.pick((window.SITE || {}).name) || '唐维西');
    updateMeta(post, title, summary || TW.autoSummary(content, 90) || title);
    $('topbarTitle').textContent = title;
    $('backText').textContent = TW.t('back');

    /* 头部 */
    const tags = (post.tags || []).map((t) =>
      `<a class="tag" href="index.html?tag=${encodeURIComponent(t)}">${TW.escapeHTML(t)}</a>`).join('');

    const updated = post.updated && post.updated !== post.date
      ? `<span class="item">${TW.t('updated')} ${TW.escapeHTML(post.updated)}</span>` : '';

    $('hero').innerHTML = `
      ${isPreview ? '<div class="article-kicker"><span class="featured-flag">预览 · 未保存的版本</span></div>' : ''}
      ${tags ? `<div class="article-kicker">${tags}</div>` : ''}
      <h1 class="article-title">${TW.escapeHTML(title)}</h1>
      ${summary ? `<p class="article-lead">${TW.escapeHTML(summary)}</p>` : ''}
      <div class="article-meta">
        <span class="item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>
          ${TW.escapeHTML(TW.formatDate(post.date))}
        </span>
        <span class="item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          ${TW.t('min_read', post.readingTime || TW.readingTime(content))}
        </span>
        <span class="item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
          ${TW.t('words', post.words || TW.countWords(content))}
        </span>
        ${updated}
      </div>
      ${post.cover ? `<div class="article-cover"><img src="${TW.escapeHTML(post.cover)}" alt="${TW.escapeHTML(title)}"></div>` : ''}
    `;

    /* 正文 */
    $('prose').innerHTML = content || '';

    // 长文里的图片等滚到附近再加载，首屏更快
    $('prose').querySelectorAll('img').forEach((img) => {
      img.loading = 'lazy';
      img.decoding = 'async';
    });

    // 指向站外的链接在新标签页打开，读者不会因为点了个链接就丢了正在读的文章
    $('prose').querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href') || '';
      if (/^https?:\/\//i.test(href) && a.hostname !== location.hostname) {
        a.target = '_blank';
        a.rel = 'noopener';
      }
    });

    highlightCode();
    initCodeCopy();
    initLightbox();
    buildTOC();
    initHeadingAnchors();
    renderPrevNext(post);
    initProgress();
  }

  /* ------------- 小节锚点：悬停标题出现 #，点一下复制直达链接 ------------- */
  function initHeadingAnchors() {
    $('prose').querySelectorAll('h2, h3').forEach((h, i) => {
      if (!h.id) h.id = 'h-' + i;
      const a = document.createElement('a');
      a.className = 'head-anchor';
      a.href = '#' + h.id;
      a.textContent = '#';
      a.setAttribute('aria-label', TW.t('copy_link'));
      a.title = TW.t('copy_link');
      a.addEventListener('click', () => {
        // 默认跳转照常发生（地址栏会带上 #小节），顺手把完整链接放进剪贴板
        const url = location.origin + location.pathname + location.search + '#' + h.id;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(url).then(() => {
            a.textContent = '✓';
            setTimeout(() => { a.textContent = '#'; }, 1200);
          }).catch(() => {});
        }
      });
      h.appendChild(a);
    });
  }

  /** 分享 / 收录用的页面信息跟着文章走：描述、封面、规范链接、结构化数据 */
  function updateMeta(post, title, desc) {
    const site = window.SITE || {};
    const set = (attr, key, value) => {
      let m = document.querySelector(`meta[${attr}="${key}"]`);
      if (!m) {
        m = document.createElement('meta');
        m.setAttribute(attr, key);
        document.head.appendChild(m);
      }
      m.setAttribute('content', value);
    };
    set('name', 'description', desc);
    set('property', 'og:title', title);
    set('property', 'og:description', desc);

    // 隐藏的文章：知道链接的人能看，但不让搜索引擎收录
    if (post.hidden) set('name', 'robots', 'noindex');

    // 封面图：分享到社交软件时显示的大图
    const cover = post.cover ? new URL(post.cover, location.href).href : '';
    if (cover) {
      set('property', 'og:image', cover);
      set('name', 'twitter:card', 'summary_large_image');
    }

    // 规范链接：填了正式网址才有意义
    const base = String(site.url || '').replace(/\/+$/, '');
    const pageUrl = base ? base + '/article.html?id=' + encodeURIComponent(post.id) : '';
    if (pageUrl) {
      let c = document.querySelector('link[rel="canonical"]');
      if (!c) {
        c = document.createElement('link');
        c.setAttribute('rel', 'canonical');
        document.head.appendChild(c);
      }
      c.setAttribute('href', pageUrl);
      set('property', 'og:url', pageUrl);
    }

    // JSON-LD：搜索引擎能读懂的「这是一篇博客文章」声明
    let ld = document.getElementById('ldjson');
    if (!ld) {
      ld = document.createElement('script');
      ld.type = 'application/ld+json';
      ld.id = 'ldjson';
      document.head.appendChild(ld);
    }
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: title,
      description: desc,
      datePublished: post.date || undefined,
      dateModified: post.updated || post.date || undefined,
      image: cover || undefined,
      url: pageUrl || undefined,
      author: { '@type': 'Person', name: TW.pick(site.name) || '唐维西' },
    });
  }

  /* ------------------- 代码块右上角的「复制」按钮 ------------------- */
  function initCodeCopy() {
    document.querySelectorAll('.prose pre').forEach((pre) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'code-copy';
      btn.textContent = TW.t('copy_code');
      btn.addEventListener('click', () => {
        const code = pre.querySelector('code') || pre;
        const write = navigator.clipboard
          ? navigator.clipboard.writeText(code.textContent)
          : Promise.reject();
        write.then(() => {
          btn.textContent = TW.t('copied');
          btn.classList.add('is-done');
          setTimeout(() => {
            btn.textContent = TW.t('copy_code');
            btn.classList.remove('is-done');
          }, 1600);
        }).catch(() => {
          // 剪贴板不可用（比如 file:// 打开）就退回老办法：选中让用户自己 ⌘C
          const range = document.createRange();
          range.selectNodeContents(code);
          const sel = getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        });
      });
      pre.appendChild(btn);
    });
  }

  /* --------------------- 通用代码高亮（无语言标记的启发式着色） --------------------- */
  function highlightCode() {
    const KEYWORDS = '(?:const|let|var|function|return|if|else|for|while|switch|case|break|continue|new|class|extends|import|export|from|default|try|catch|finally|throw|async|await|typeof|instanceof|of|this|super|null|undefined|true|false|void|yield|static|def|elif|except|lambda|pass|raise|with|as|is|not|and|or|None|True|False|self|struct|enum|impl|fn|pub|mut|match|func|chan|defer|interface|type|package|range|echo|then|fi|done|esac|local|public|private|protected|final|int|float|double|char|bool|string)';
    let TOKEN;
    try {
      TOKEN = new RegExp(
        '((?<!:)\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/|#(?:\\s|!)[^\\n]*)' +          // 注释
        '|("(?:[^"\\\\\\n]|\\\\.)*"|\'(?:[^\'\\\\\\n]|\\\\.)*\'|`(?:[^`\\\\]|\\\\.)*`)' + // 字符串
        '|(\\b\\d+(?:\\.\\d+)?\\b)' +                                                // 数字
        '|(\\b' + KEYWORDS + '\\b)', 'g');
    } catch (_) { return; /* 老浏览器不支持后行断言就放弃着色 */ }

    document.querySelectorAll('.prose pre code').forEach((code) => {
      const src = code.textContent;
      let out = '';
      let last = 0;
      let m;
      TOKEN.lastIndex = 0;
      while ((m = TOKEN.exec(src))) {
        out += TW.escapeHTML(src.slice(last, m.index));
        const cls = m[1] ? 'tok-cmt' : m[2] ? 'tok-str' : m[3] ? 'tok-num' : 'tok-kw';
        out += `<span class="${cls}">${TW.escapeHTML(m[0])}</span>`;
        last = m.index + m[0].length;
      }
      out += TW.escapeHTML(src.slice(last));
      code.innerHTML = out;
    });
  }

  /* --------------------- 图片灯箱：从原图位置弹出，可随时点回去 --------------------- */
  function initLightbox() {
    document.querySelectorAll('.prose img').forEach((img) => {
      img.addEventListener('click', () => openLightbox(img));
    });
  }

  function openLightbox(thumb) {
    const box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', thumb.alt || '图片预览');
    const big = document.createElement('img');
    big.src = thumb.currentSrc || thumb.src;
    big.alt = thumb.alt || '';
    box.appendChild(big);
    document.body.appendChild(box);

    // FLIP：先摆到缩略图的位置和大小，再弹回居中 —— 动画从当前值出发
    const place = () => {
      const from = thumb.getBoundingClientRect();
      const to = big.getBoundingClientRect();
      if (!to.width || !to.height) return;
      const s = from.width / to.width;
      const dx = from.left + from.width / 2 - (to.left + to.width / 2);
      const dy = from.top + from.height / 2 - (to.top + to.height / 2);
      big.style.transform = `translate(${dx}px, ${dy}px) scale(${s})`;
    };

    const open = () => {
      place();
      requestAnimationFrame(() => {
        box.classList.add('is-open');
        big.style.transform = '';
      });
    };
    if (big.complete) requestAnimationFrame(open);
    else big.addEventListener('load', () => requestAnimationFrame(open), { once: true });

    // 打开期间锁住背景滚动
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';

    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      place();                        // 从当前位置收回缩略图处
      box.classList.remove('is-open');
      window.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = prevOverflow;
      box.addEventListener('transitionend', () => box.remove(), { once: true });
      setTimeout(() => box.remove(), 700); // 兜底
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };

    box.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
  }

  /* ------------------------------ 目录生成 ------------------------------ */
  function buildTOC() {
    const heads = [...$('prose').querySelectorAll('h2, h3')];
    if (heads.length < 2) return;

    const toc = $('toc');
    toc.hidden = false;
    toc.innerHTML =
      '<div class="toc-indicator"></div>' +
      `<div class="toc-title">${TW.t('toc')}</div>` +
      heads.map((h, i) => {
        if (!h.id) h.id = 'h-' + i;
        const lvl = h.tagName === 'H3' ? ' lvl-3' : '';
        return `<a href="#${h.id}" class="${lvl.trim()}">${TW.escapeHTML(h.textContent)}</a>`;
      }).join('');

    const links = [...toc.querySelectorAll('a')];
    const indicator = toc.querySelector('.toc-indicator');

    // 高亮指示器是一枚会滑过去的胶囊，不是逐条闪烁的边框
    function moveTo(link) {
      indicator.style.height = link.offsetHeight + 'px';
      indicator.style.transform = `translateY(${link.offsetTop}px)`;
      toc.classList.add('has-active');
    }

    function setActive(id) {
      let hit = null;
      links.forEach((a) => {
        const on = a.getAttribute('href') === '#' + id;
        a.classList.toggle('active', on);
        if (on) hit = a;
      });
      if (hit) moveTo(hit);
    }

    // 滚动时高亮当前小节
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); });
    }, { rootMargin: '-104px 0px -70% 0px' });
    heads.forEach((h) => spy.observe(h));

    // 悬停时指示器就先跟过去 —— 反馈发生在动作当下，不等点击
    links.forEach((a) => {
      a.addEventListener('pointerenter', () => moveTo(a));
    });
    toc.addEventListener('pointerleave', () => {
      const on = toc.querySelector('a.active');
      if (on) moveTo(on);
    });
  }

  /* ------------------------------ 上下篇 ------------------------------ */
  function renderPrevNext(post) {
    const i = LIST.findIndex((a) => a.id === post.id);
    const prev = i > 0 ? LIST[i - 1] : null;          // 列表按新→旧排序，所以上一个是更新的
    const next = i >= 0 && i < LIST.length - 1 ? LIST[i + 1] : null;

    const tagsHTML = (post.tags || []).length
      ? `<div class="tag-list">${(post.tags || []).map((t) => `<a class="tag" href="index.html?tag=${encodeURIComponent(t)}">${TW.escapeHTML(t)}</a>`).join('')}</div>` : '';

    const link = (a, dir, cls) => a
      ? `<a class="${cls}" href="article.html?id=${encodeURIComponent(a.id)}"><div class="dir">${dir}</div><div class="t">${TW.escapeHTML(TW.pick(a.title))}</div></a>`
      : '<span></span>';

    $('articleEnd').innerHTML = tagsHTML + shareHTML() + renderRelated(post) + `<div class="prevnext">
      ${link(prev, '← ' + TW.t('prev'), 'prev-item')}
      ${link(next, TW.t('next') + ' →', 'next-item')}
    </div>`;
    bindShare(post);
  }

  /* ------------------------ 文末分享：复制链接 / 系统分享 ------------------------ */
  function shareHTML() {
    const native = navigator.share
      ? `<button class="share-btn" id="shareNative" type="button">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v13"/><path d="m7 8 5-5 5 5"/><path d="M4 14v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/></svg>
           ${TW.t('share')}</button>` : '';
    return `<div class="share-row">
      <button class="share-btn" id="shareCopy" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>
        ${TW.t('copy_link')}</button>
      ${native}
    </div>`;
  }

  function bindShare(post) {
    // 填了正式网址就分享正式链接，否则分享本地地址（局域网里也能用）
    const site = window.SITE || {};
    const base = String(site.url || '').replace(/\/+$/, '');
    const url = base ? base + '/article.html?id=' + encodeURIComponent(post.id) : location.href;
    const title = TW.pick(post.title);

    const copyBtn = $('shareCopy');
    copyBtn.addEventListener('click', () => {
      const done = () => {
        const old = copyBtn.innerHTML;
        copyBtn.textContent = '✓ ' + TW.t('link_copied');
        setTimeout(() => { copyBtn.innerHTML = old; }, 1500);
      };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(done).catch(() => prompt(TW.t('copy_link'), url));
      else prompt(TW.t('copy_link'), url);
    });

    const nativeBtn = $('shareNative');
    if (nativeBtn) {
      nativeBtn.addEventListener('click', () => {
        navigator.share({ title, url }).catch(() => { /* 用户取消了就算了 */ });
      });
    }
  }

  /* ------------------------ 相关阅读：按共同标签推荐 ------------------------ */
  function renderRelated(post) {
    const mine = new Set(post.tags || []);
    const picks = LIST
      .filter((a) => a.id !== post.id && a.status !== 'draft')
      .map((a) => ({ a, score: (a.tags || []).filter((t) => mine.has(t)).length }))
      .filter((x) => x.score > 0)
      .sort((x, y) => y.score - x.score || (y.a.date || '').localeCompare(x.a.date || ''))
      .slice(0, 3);
    if (!picks.length) return '';

    return `<div class="related">
      <div class="related-head">${TW.t('related')}</div>
      <div class="related-list">${picks.map(({ a }) => `
        <a class="related-item" href="article.html?id=${encodeURIComponent(a.id)}">
          <span class="rt">${TW.escapeHTML(TW.pick(a.title))}</span>
          <span class="rd">${TW.escapeHTML(TW.formatDate(a.date))}</span>
        </a>`).join('')}
      </div>
    </div>`;
  }

  /* ---------------------------- 阅读进度 ---------------------------- */
  function initProgress() {
    const bar = $('readProgress');
    TW.onScrollFrame(() => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? Math.min(100, (window.scrollY / h) * 100) : 0) + '%';
    });
  }

  function showError(msg) {
    $('hero').innerHTML = `<h1 class="article-title">🤔</h1><p class="article-lead">${TW.escapeHTML(msg)}</p>`;
    $('prose').innerHTML = `<p><a href="index.html">← ${TW.t('back')}</a></p>`;
  }

  /* -------------------------------- 启动 -------------------------------- */
  let current = null;
  loadPost(id)
    .then((post) => { current = post; render(post); })
    .catch((e) => showError(e.message + '。' + TW.t('not_found')));

  TW.initLang('langToggle', () => { if (current) render(current); });
})();
