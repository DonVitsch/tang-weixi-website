/* ============================================================
   后台逻辑：文章增删改、自动填格式、上传图片、网站设置
   ============================================================ */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  let DB = { site: {}, articles: [] };
  let currentId = null;
  let editor = null;
  let dirty = false;
  let saveTimer = null;

  /* ------------------------------ 服务器通信 ------------------------------ */
  function authToken() { return localStorage.getItem('tw-admin-token') || ''; }

  async function api(path, body) {
    let res;
    try {
      res = await fetch(path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': authToken() },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (e) {
      throw new Error('连不上本地服务器 —— 请先双击「启动.command」把网站跑起来');
    }
    const data = await res.json().catch(() => ({ ok: false, error: '服务器返回的内容看不懂' }));
    if (!data.ok) {
      if (data.code === 'AUTH') requireAuth();   // 令牌过期了，重新弹密码框
      throw new Error(data.error || '操作失败');
    }
    return data;
  }

  /* ------------------------------ 管理员密码门 ------------------------------ */
  let authMask = null;

  function requireAuth(mode) {
    if (authMask) return authMask.promise;
    let resolveDone;
    const promise = new Promise((r) => { resolveDone = r; });

    const isSetup = mode === 'setup';
    const mask = document.createElement('div');
    mask.className = 'auth-mask';
    mask.innerHTML = `
      <div class="auth-card">
        <div class="lock">${isSetup ? '🔐' : '🔒'}</div>
        <h2>${isSetup ? '给后台设置一个密码' : '输入管理员密码'}</h2>
        <p>${isSetup
          ? '以后进入写文章后台都需要这个密码。<br>建议 8 位以上、别用纯数字或生日。<br>忘了的话要删掉 data 文件夹里的 admin-pass.json 才能重设。'
          : '这里是写文章的后台，需要密码才能进入。'}</p>
        <input type="password" id="authPw" placeholder="${isSetup ? '设一个密码（至少 4 位，越长越安全）' : '密码'}">
        ${isSetup ? '<input type="password" id="authPw2" placeholder="再输一遍">' : ''}
        <button class="btn btn-primary btn-lg" id="authGo">${isSetup ? '设置并进入' : '进入后台'}</button>
        <div class="auth-err" id="authErr"></div>
      </div>`;
    document.body.appendChild(mask);
    authMask = { el: mask, promise };

    const err = (m) => { mask.querySelector('#authErr').textContent = m || ''; };
    const go = async () => {
      const pw = mask.querySelector('#authPw').value;
      if (isSetup) {
        if (pw.length < 4) return err('密码至少要 4 位');
        if (pw !== mask.querySelector('#authPw2').value) return err('两次输入的不一样');
      } else if (!pw) return err('请输入密码');
      try {
        err('');
        const res = await fetch('/api/auth/' + (isSetup ? 'setup' : 'login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pw }),
        }).then((r) => r.json());
        if (!res.ok) return err(res.error || '验证失败');
        localStorage.setItem('tw-admin-token', res.token);
        mask.remove();
        authMask = null;
        resolveDone();
      } catch (e) { err('连不上本地服务器'); }
    };
    mask.querySelector('#authGo').addEventListener('click', go);
    mask.querySelectorAll('input').forEach((i) =>
      i.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); }));
    mask.querySelector('#authPw').focus();
    return promise;
  }

  async function ensureAuth() {
    let st;
    try {
      st = await fetch('/api/auth/status', { headers: { 'x-auth-token': authToken() } }).then((r) => r.json());
    } catch (e) { return; /* 服务器没开，boot 里会给出提示 */ }
    if (!st.set) await requireAuth('setup');
    else if (!st.authed) await requireAuth('login');
  }

  function toast(msg, isError) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.toggle('error', !!isError);
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), isError ? 4200 : 2000);
  }

  function setSaveState(state, text) {
    const el = $('saveState');
    el.className = 'save-state ' + (state || '');
    el.textContent = text || '';
  }

  /* -------------------------------- 数据 -------------------------------- */
  function blankArticle() {
    return {
      id: TW.newId(),
      title: '',
      summary: '',
      content: '',
      cover: '',
      tags: [],
      date: TW.today(),
      updated: TW.today(),
      readingTime: 1,
      rtManual: false,   // 用户有没有手动改过阅读时间；没改过就一直自动算
      words: 0,
      pinned: false,
      status: 'draft',
      hidden: false,
      externalUrl: '',
    };
  }

  function current() {
    return DB.articles.find((a) => a.id === currentId) || null;
  }

  function sorted() {
    return DB.articles.slice().sort((a, b) => {
      // 置顶永远排在最前；同为置顶/非置顶时，日期新→旧
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return String(b.date || '').localeCompare(String(a.date || ''));
    });
  }

  /* ------------------------------ 左侧列表 ------------------------------ */
  function renderList() {
    const q = $('sideSearch').value.trim().toLowerCase();
    const list = sorted().filter((a) => {
      if (!q) return true;
      return ((a.title || '') + ' ' + (a.summary || '') + ' ' + (a.tags || []).join(' ')).toLowerCase().includes(q);
    });

    const drafts = list.filter((a) => a.status === 'draft');
    const published = list.filter((a) => a.status !== 'draft');

    const item = (a) => `
      <div class="post-item ${a.id === currentId ? 'active' : ''}" data-id="${a.id}">
        <div class="t">${TW.escapeHTML(a.title || '（未命名）')}</div>
        <div class="m">
          <span>${TW.escapeHTML(a.date || '')}</span>
          ${a.pinned ? '<span class="badge badge-pinned">置顶</span>' : ''}
          ${a.status === 'draft' ? '<span class="badge badge-draft">草稿</span>' : ''}
          ${a.hidden ? '<span class="badge badge-hidden">已隐藏</span>' : ''}
          ${readWip(a.id) ? '<span class="badge badge-updated">未保存</span>' : ''}
          <span>${a.words || 0} 字</span>
        </div>
      </div>`;

    let html = '';
    if (drafts.length) html += '<div class="list-group-title">草稿 ' + drafts.length + '</div>' + drafts.map(item).join('');
    if (published.length) html += '<div class="list-group-title">已发布 ' + published.length + '</div>' + published.map(item).join('');
    if (!html) html = '<div style="padding:30px 16px;text-align:center;color:var(--text-tertiary);font-size:13px;line-height:1.8">' +
      (q ? '没找到匹配的文章' : '还没有文章<br>点上面的按钮写第一篇吧') + '</div>';

    $('postList').innerHTML = html;
    $('postList').querySelectorAll('.post-item').forEach((n) => {
      n.addEventListener('click', () => selectArticle(n.dataset.id));
    });

    // 底部的全站统计：写了多少一目了然
    const pub = DB.articles.filter((a) => a.status !== 'draft');
    const words = DB.articles.reduce((s, a) => s + (a.words || 0), 0);
    $('sideStats').textContent = DB.articles.length
      ? `共 ${DB.articles.length} 篇（发布 ${pub.length}）· 累计 ${words >= 10000 ? (words / 10000).toFixed(1) + ' 万' : words} 字`
      : '';
  }

  /* ------------------------------ 打开文章 ------------------------------ */
  function selectArticle(id) {
    if (dirty) stashNow();          // 切走前把没保存的改动暂存住，绝不静默发布
    currentId = id;
    const a = current();
    if (!a) return;

    // 有暂存的未保存改动就先恢复出来
    const wip = readWip(id);
    const restored = !!(wip && wip.a);
    if (restored) Object.assign(a, wip.a);

    $('blank').hidden = true;
    $('editorPage').hidden = false;
    $('statsBar').hidden = false;

    $('titleInput').value = a.title || '';
    $('summaryInput').value = a.summary || '';
    $('dateInput').value = a.date || TW.today();
    $('rtInput').value = a.readingTime || 1;
    $('pinInput').checked = !!a.pinned;
    setCover(a.cover || '');
    renderTags();

    editor.setHTML(a.content || '');
    autoGrow($('titleInput'));
    autoGrow($('summaryInput'));
    updateStats();
    updatePublishButtons();
    renderList();
    if (restored) {
      dirty = true;
      setSaveState('saving', '恢复了未保存的改动 · 点「保存」更新到网站');
    } else {
      dirty = false;
      setSaveState('', '');
    }
    $('mainScroll').scrollTop = 0;
  }

  function updatePublishButtons() {
    const a = current();
    if (!a) return;
    $('publishBtn').textContent = a.status === 'draft' ? '发布' : '已发布 ✓';
    $('publishBtn').disabled = a.status !== 'draft';
    $('draftBtn').textContent = a.status === 'draft' ? '存草稿' : '转为草稿';
    $('hideBtn').textContent = a.hidden ? '取消隐藏' : '隐藏';
    $('hideBtn').classList.toggle('btn-danger', !!a.hidden);
  }

  /* ------------------------------ 封面处理 ------------------------------ */
  function setCover(url) {
    const img = $('coverImg');
    const hint = $('coverHint');
    if (url) {
      img.src = url; img.hidden = false; hint.hidden = true;
      $('coverZone').style.background = '';
    } else {
      img.hidden = true; hint.hidden = false;
      // 实时预览"不传封面时自动生成的那张"长什么样
      const a = current();
      const title = a ? (a.title || '') : '';
      const glyph = title.trim().charAt(0) || '文';
      const label = (a && a.tags && a.tags[0]) || (a && TW.formatDate(a.date)) || '';
      $('coverZone').style.cssText = TW.autoCoverStyle((a ? a.id : '') + title);
      hint.innerHTML =
        '<span class="cover-glyph">' + TW.escapeHTML(glyph) + '</span>' +
        (label ? '<span class="cover-tagline">' + TW.escapeHTML(label) + '</span>' : '') +
        '<b style="color:#fff;text-shadow:0 1px 8px rgba(0,0,0,.45);position:relative;z-index:3">自动生成的封面长这样</b>' +
        '<span style="color:rgba(255,255,255,.92);text-shadow:0 1px 8px rgba(0,0,0,.45);position:relative;z-index:3">点这里上传自己的封面图，或者直接拖一张进来</span>';
    }
  }

  async function uploadFile(file) {
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error('图片读取失败'));
      r.readAsDataURL(file);
    });
    const res = await api('/api/upload', { name: file.name, dataUrl });
    return res.url;
  }

  function initCover() {
    const zone = $('coverZone');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    const doUpload = async (file) => {
      if (!file) return;
      try {
        toast('封面上传中…');
        const url = await uploadFile(file);
        const a = current();
        if (a) { a.cover = url; setCover(url); markDirty(); }
        toast('封面已换好');
      } catch (e) { toast(e.message, true); }
    };

    input.addEventListener('change', () => { doUpload(input.files[0]); input.value = ''; });
    zone.addEventListener('click', (e) => {
      if (e.target.closest('.cover-actions')) return;
      input.click();
    });
    $('coverChange').addEventListener('click', (e) => { e.stopPropagation(); input.click(); });
    $('coverRemove').addEventListener('click', (e) => {
      e.stopPropagation();
      const a = current();
      if (a) { a.cover = ''; setCover(''); markDirty(); }
    });

    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag');
      doUpload(e.dataTransfer.files[0]);
    });
  }

  /* ------------------------------ 标签编辑 ------------------------------ */
  function renderTags() {
    const a = current();
    if (!a) return;
    const box = $('tagsEdit');
    box.innerHTML =
      (a.tags || []).map((t, i) =>
        `<span class="tag-pill">${TW.escapeHTML(t)}<button data-i="${i}" title="删掉">×</button></span>`).join('') +
      '<input class="tag-add" id="tagAdd" placeholder="+ 加标签" list="tagSuggest">' +
      '<datalist id="tagSuggest">' + knownTags().map((t) => `<option value="${TW.escapeHTML(t)}">`).join('') + '</datalist>';

    box.querySelectorAll('.tag-pill button').forEach((b) => {
      b.addEventListener('click', () => {
        a.tags.splice(+b.dataset.i, 1);
        renderTags(); markDirty();
      });
    });

    const add = $('tagAdd');
    add.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',' || e.key === '，') {
        e.preventDefault();
        const v = add.value.trim();
        if (v && (a.tags || []).indexOf(v) === -1) {
          a.tags = a.tags || [];
          a.tags.push(v);
          renderTags();
          $('tagAdd').focus();
          markDirty();
        } else { add.value = ''; }
      } else if (e.key === 'Backspace' && !add.value && a.tags.length) {
        a.tags.pop(); renderTags(); $('tagAdd').focus(); markDirty();
      }
    });
    add.addEventListener('blur', () => {
      const v = add.value.trim();
      if (v && (a.tags || []).indexOf(v) === -1) { a.tags.push(v); renderTags(); markDirty(); }
    });
  }

  function knownTags() {
    const set = new Set(DB.site.tags || []);
    DB.articles.forEach((a) => (a.tags || []).forEach((t) => set.add(t)));
    return [...set];
  }

  /* ---------------------------- 统计 & 自动填写 ---------------------------- */
  function updateStats() {
    const html = editor ? editor.getHTML() : '';
    const words = TW.countWords(editor ? editor.getText() : '');
    const rt = TW.readingTime(html);
    const imgs = (html.match(/<img/g) || []).length;

    $('statWords').textContent = words + ' 字';
    $('statRead').textContent = '约 ' + rt + ' 分钟';
    $('statImgs').textContent = imgs + ' 张图';

    // 用户没手动改过阅读时间的话，输入框跟着正文实时变
    const a = current();
    if (a && !a.rtManual) $('rtInput').value = rt;

    return { words, rt, imgs, html };
  }

  /** 把界面上的内容收进数据对象，顺手把统一格式的字段自动填好 */
  function collect() {
    const a = current();
    if (!a) return null;
    const s = updateStats();

    a.title = $('titleInput').value.trim();
    a.content = s.html;
    a.date = $('dateInput').value || TW.today();
    a.pinned = $('pinInput').checked;
    a.words = s.words;

    // 摘要：没填就自动从正文开头提取
    const typed = $('summaryInput').value.trim();
    a.summary = typed || TW.autoSummary(s.html, 90);

    // 阅读时间：用户手动改过就尊重他的，否则永远按字数自动算
    const typedRt = parseInt($('rtInput').value, 10);
    a.readingTime = a.rtManual && typedRt > 0 ? typedRt : s.rt;

    a.updated = TW.today();
    return a;
  }

  /* —— 保存模型 ——
     改动只会先「暂存」在这台电脑的浏览器里（防止丢稿），
     点「保存」按钮（或 ⌘S）才会真正写进网站、让读者看到。 */

  const wipKey = (id) => 'tw-wip:' + id;

  function readWip(id) {
    try { return JSON.parse(localStorage.getItem(wipKey(id)) || 'null'); } catch (e) { return null; }
  }

  function stashNow() {
    const a = collect();
    if (!a) return;
    try { localStorage.setItem(wipKey(a.id), JSON.stringify({ t: Date.now(), a })); } catch (e) { /* 存储满了也不至于打断写作 */ }
    setSaveState('saving', '已暂存 · 点「保存」才会更新到网站');
    renderList();
  }

  function markDirty() {
    dirty = true;
    setSaveState('saving', '未保存…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(stashNow, 500);   // 停手半秒后暂存到本机（不会发布）
  }

  async function saveNow(silent) {
    const a = collect();
    if (!a) return;
    clearTimeout(saveTimer);
    try {
      setSaveState('saving', '保存中…');
      await api('/api/article/save', { article: a });
      dirty = false;
      localStorage.removeItem(wipKey(a.id));
      setSaveState('saved', '已保存 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
      renderList();
    } catch (e) {
      setSaveState('error', '保存失败（内容已暂存在本机）');
      if (!silent) toast(e.message, true);
    }
  }

  /* ------------------------------ 自动撑高 ------------------------------ */
  function autoGrow(el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  /* ------------------------------ 网站设置 ------------------------------ */
  // 图标 key → 中文说明（仅用于下拉选项；真正显示在网站上的名字是「显示名称」那一栏）
  const ICON_OPTIONS = [
    ['github', 'GitHub'],
    ['mail', '邮箱'],
    ['wechat', '微信'],
    ['bilibili', 'B站'],
    ['zhihu', '知乎'],
    ['x', 'X / Twitter'],
    ['xiaohongshu', '小红书'],
    ['rss', 'RSS'],
    ['book', '书'],
    ['link', '通用链接'],
  ];

  function defaultLinkAction(icon, url) {
    const u = String(url || '').trim();
    if (/^(https?:|mailto:|tel:)/i.test(u)) return 'open';
    if (icon === 'mail' || icon === 'wechat') return 'copy';
    if (u && u.indexOf('@') !== -1 && u.indexOf(' ') === -1) return 'copy';
    return 'open';
  }

  function openSiteSettings() {
    const s = DB.site || {};
    const links = JSON.parse(JSON.stringify(s.links || []));
    const tagList = (s.tags || []).slice();

    const linkRow = (l) => {
      const name = typeof l.name === 'string' ? l.name : (l.name && l.name.zh) || '';
      const action = l.action === 'copy' || l.action === 'open'
        ? l.action
        : defaultLinkAction(l.icon, l.url);
      const urlPh = action === 'copy' ? '要复制的内容，如微信号 / 邮箱' : 'https://… 或 mailto:…';
      return `
      <div class="link-row">
        <select class="l-icon" title="图标样式">${ICON_OPTIONS.map(([o, label]) =>
          `<option value="${o}" ${l.icon === o ? 'selected' : ''}>${label}</option>`).join('')}</select>
        <input class="l-name" type="text" value="${TW.escapeHTML(name)}" placeholder="显示名称（可随便改）" title="网站上显示的文字，随意填写">
        <input class="l-url" type="text" value="${TW.escapeHTML(l.url || '')}" placeholder="${TW.escapeHTML(urlPh)}" title="打开模式填网址；复制模式填要复制的文字">
        <select class="l-action" title="点击后的行为">
          <option value="open" ${action === 'open' ? 'selected' : ''}>打开链接</option>
          <option value="copy" ${action === 'copy' ? 'selected' : ''}>复制内容</option>
        </select>
        <button class="del" type="button" title="删掉">×</button>
      </div>`;
    };

    const friends = JSON.parse(JSON.stringify(s.friends || []));
    const friendRow = (f) => `
      <div class="friend-row">
        <input class="f-name" value="${TW.escapeHTML(f.name || '')}" placeholder="名字">
        <input class="f-url" value="${TW.escapeHTML(f.url || '')}" placeholder="https://…">
        <input class="f-desc" value="${TW.escapeHTML(f.desc || '')}" placeholder="一句话介绍（可空）">
        <button class="del" title="删掉">×</button>
      </div>`;

    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = `
      <div class="modal">
        <div class="modal-head"><h3>网站设置</h3><button class="btn btn-sm" data-close>关闭</button></div>
        <div class="modal-body">
          <div class="field">
            <label>网站名字（首页大标题）</label>
            <input type="text" id="sName" value="${TW.escapeHTML(TW.pick(s.name))}">
          </div>
          <div class="field">
            <label>英文名（切到 En 时显示，可留空）</label>
            <input type="text" id="sNameEn" value="${TW.escapeHTML((s.name && s.name.en) || '')}">
          </div>
          <div class="field">
            <label>一句话简介</label>
            <textarea id="sTag">${TW.escapeHTML(TW.pick(s.tagline))}</textarea>
          </div>
          <div class="field">
            <label>英文简介（可留空）</label>
            <textarea id="sTagEn">${TW.escapeHTML((s.tagline && s.tagline.en) || '')}</textarea>
          </div>
          <div class="field">
            <label>头像 / Logo（首页、关于页、后台都用它）</label>
            <div class="avatar-edit">
              <div class="avatar-preview" id="sAvatarPrev" title="点击上传自己的头像"></div>
              <div class="avatar-opts">
                <select id="sLogo">
                  <option value="github" ${s.logo === 'github' ? 'selected' : ''}>GitHub 图标</option>
                  <option value="text" ${s.logo === 'text' ? 'selected' : ''}>文字圆标（用下面这个字）</option>
                  <option value="none" ${s.logo === 'none' ? 'selected' : ''}>不显示 Logo</option>
                  <option value="__img" ${s.logo && s.logo.indexOf('uploads/') === 0 ? 'selected' : ''}>用我自己的图片</option>
                </select>
                <div style="display:flex;gap:8px;align-items:center">
                  <input type="text" id="sLogoText" style="width:80px" value="${TW.escapeHTML(s.logoText || '唐')}" placeholder="唐">
                  <button class="btn btn-sm" id="sLogoUpload" type="button">上传头像图片</button>
                </div>
              </div>
            </div>
            <div class="hint">左边是实时预览，点它（或右边按钮）可以直接上传图片。选「文字圆标」时用上面那个字。</div>
          </div>
          <div class="field">
            <label>页脚文字</label>
            <input type="text" id="sFooter" value="${TW.escapeHTML(TW.pick(s.footer))}">
          </div>
          <div class="field">
            <label>网站正式网址（可留空）</label>
            <input type="url" id="sUrl" value="${TW.escapeHTML(s.url || '')}" placeholder="https://example.com">
            <div class="hint">以后网站上线了再填，用于生成 RSS 订阅和站点地图里的完整链接。本地使用不用管。</div>
          </div>
          <div class="field">
            <label>首页 / 关于页那排图标链接</label>
            <div class="link-row link-row-head" aria-hidden="true">
              <span>图标</span>
              <span>显示名称</span>
              <span>链接 / 复制内容</span>
              <span>点击行为</span>
              <span></span>
            </div>
            <div id="linkRows">${links.map(linkRow).join('')}</div>
            <button class="btn btn-sm" id="addLink" type="button" style="margin-top:8px">+ 加一个链接</button>
            <div class="hint">
              <strong>显示名称</strong>可随便改（比如「我的邮箱」「加微信」）。
              <strong>点击行为</strong>每条单独设：
              「打开链接」会跳转；「复制内容」点一下把右边那栏复制到剪贴板（适合微信、邮箱）。
              邮箱复制模式直接填 <code>you@mail.com</code> 即可，不必写 mailto:。
            </div>
          </div>
          <div class="field">
            <label>标签库（教程 / 工具 / 随笔…）</label>
            <div class="tags-edit" id="sTags"></div>
            <div class="hint">写文章加标签时会推荐这里的词。首页筛选条只显示文章实际用到的标签，所以删掉某个词不影响已有文章。</div>
          </div>
          <div class="field">
            <label>友链（朋友们的网站，显示在「友链」页）</label>
            <div id="friendRows">${friends.map(friendRow).join('')}</div>
            <button class="btn btn-sm" id="addFriend" type="button" style="margin-top:8px">+ 加一个朋友</button>
            <div class="hint">名字和网址必填，一句话介绍可以不写。头像不填的话，会按名字自动配一个渐变色圆标。</div>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn" data-close>取消</button>
          <button class="btn btn-primary" id="sSave">保存设置</button>
        </div>
      </div>`;
    document.body.appendChild(mask);

    let logoImg = s.logo && s.logo.indexOf('uploads/') === 0 ? s.logo : '';

    const close = () => mask.remove();
    mask.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
    mask.addEventListener('click', (e) => { if (e.target === mask) close(); });

    /* 头像实时预览：改选项、改字、上传图，立刻能看到效果 */
    const paintAvatar = () => {
      const sel = mask.querySelector('#sLogo').value;
      const prev = mask.querySelector('#sAvatarPrev');
      const ch = mask.querySelector('#sLogoText').value.trim() ||
                 (mask.querySelector('#sName').value.trim() || '唐').charAt(0);
      if (sel === '__img' && logoImg) prev.innerHTML = '<img src="' + TW.escapeHTML(logoImg) + '" alt="">';
      else if (sel === 'github') prev.innerHTML = TW.icon('github');
      else if (sel === 'none') prev.innerHTML = '<span class="muted">无</span>';
      else prev.textContent = ch;
    };
    ['#sLogo', '#sLogoText', '#sName'].forEach((q) =>
      mask.querySelector(q).addEventListener('input', paintAvatar));
    paintAvatar();

    /* 标签库编辑：和文章标签一样的胶囊交互 */
    const paintTags = () => {
      const box = mask.querySelector('#sTags');
      box.innerHTML =
        tagList.map((t, i) =>
          `<span class="tag-pill">${TW.escapeHTML(t)}<button data-i="${i}" type="button" title="删掉">×</button></span>`).join('') +
        '<input class="tag-add" id="sTagAdd" placeholder="+ 加一个（回车确认）">';
      box.querySelectorAll('.tag-pill button').forEach((b) => {
        b.addEventListener('click', () => { tagList.splice(+b.dataset.i, 1); paintTags(); });
      });
      const add = box.querySelector('#sTagAdd');
      const commit = () => {
        const v = add.value.trim();
        if (v && tagList.indexOf(v) === -1) { tagList.push(v); paintTags(); mask.querySelector('#sTagAdd').focus(); }
        else add.value = '';
      };
      add.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',' || e.key === '，') { e.preventDefault(); commit(); }
        else if (e.key === 'Backspace' && !add.value && tagList.length) { tagList.pop(); paintTags(); mask.querySelector('#sTagAdd').focus(); }
      });
      add.addEventListener('blur', commit);
    };
    paintTags();

    function bindLinkRows() {
      mask.querySelectorAll('.link-row:not(.link-row-head)').forEach((row) => {
        const iconSel = row.querySelector('.l-icon');
        const actionSel = row.querySelector('.l-action');
        const urlInput = row.querySelector('.l-url');
        const nameInput = row.querySelector('.l-name');
        const syncPlaceholder = () => {
          if (!urlInput || !actionSel) return;
          urlInput.placeholder = actionSel.value === 'copy'
            ? '要复制的内容，如微信号 / 邮箱'
            : 'https://… 或 mailto:…';
        };
        if (actionSel && !actionSel._bound) {
          actionSel._bound = true;
          actionSel.addEventListener('change', syncPlaceholder);
        }
        // 换图标时：若显示名还空，用图标中文名填一下；微信/邮箱默认倾向「复制」
        if (iconSel && !iconSel._bound) {
          iconSel._bound = true;
          iconSel.addEventListener('change', () => {
            const opt = ICON_OPTIONS.find(([k]) => k === iconSel.value);
            if (nameInput && !nameInput.value.trim() && opt) nameInput.value = opt[1];
            if (actionSel && (iconSel.value === 'mail' || iconSel.value === 'wechat')) {
              actionSel.value = 'copy';
            }
            syncPlaceholder();
          });
        }
        syncPlaceholder();
      });
    }

    mask.querySelector('#addLink').addEventListener('click', () => {
      const rows = mask.querySelector('#linkRows');
      const div = document.createElement('div');
      div.innerHTML = linkRow({ icon: 'link', name: '', url: '', action: 'open' });
      rows.appendChild(div.firstElementChild);
      bindDel();
      bindLinkRows();
      rows.lastElementChild.querySelector('.l-name').focus();
    });

    mask.querySelector('#addFriend').addEventListener('click', () => {
      const rows = mask.querySelector('#friendRows');
      const div = document.createElement('div');
      div.innerHTML = friendRow({ name: '', url: '', desc: '' });
      rows.appendChild(div.firstElementChild);
      bindDel();
      rows.lastElementChild.querySelector('.f-name').focus();
    });

    function bindDel() {
      mask.querySelectorAll('.link-row .del, .friend-row .del').forEach((b) => {
        b.onclick = () => b.closest('.link-row, .friend-row').remove();
      });
    }
    bindDel();
    bindLinkRows();

    const logoInput = document.createElement('input');
    logoInput.type = 'file'; logoInput.accept = 'image/*';
    logoInput.addEventListener('change', async () => {
      if (!logoInput.files[0]) return;
      try {
        logoImg = await uploadFile(logoInput.files[0]);
        mask.querySelector('#sLogo').value = '__img';
        paintAvatar();
        toast('头像已上传');
      } catch (e) { toast(e.message, true); }
    });
    mask.querySelector('#sLogoUpload').addEventListener('click', () => logoInput.click());
    mask.querySelector('#sAvatarPrev').addEventListener('click', () => logoInput.click());

    mask.querySelector('#sSave').addEventListener('click', async () => {
      const logoSel = mask.querySelector('#sLogo').value;
      const site = {
        name: { zh: mask.querySelector('#sName').value.trim(), en: mask.querySelector('#sNameEn').value.trim() },
        tagline: { zh: mask.querySelector('#sTag').value.trim(), en: mask.querySelector('#sTagEn').value.trim() },
        footer: { zh: mask.querySelector('#sFooter').value.trim(), en: mask.querySelector('#sFooter').value.trim() },
        url: TW.siteBase(mask.querySelector('#sUrl').value),
        logo: logoSel === '__img' ? (logoImg || 'github') : logoSel,
        logoText: mask.querySelector('#sLogoText').value.trim() || '唐',
        links: [...mask.querySelectorAll('.link-row:not(.link-row-head)')].map((r) => {
          const icon = r.querySelector('.l-icon').value;
          const action = r.querySelector('.l-action').value === 'copy' ? 'copy' : 'open';
          return {
            icon,
            name: r.querySelector('.l-name').value.trim(),
            url: r.querySelector('.l-url').value.trim(),
            action,
            color: brandColor(icon),
          };
        }).filter((l) => l.url && l.name),
        friends: [...mask.querySelectorAll('.friend-row')].map((r) => ({
          name: r.querySelector('.f-name').value.trim(),
          url: r.querySelector('.f-url').value.trim(),
          desc: r.querySelector('.f-desc').value.trim(),
        })).filter((f) => f.url && f.name),
        tags: tagList,
      };
      try {
        await api('/api/site/save', { site });
        DB.site = Object.assign({}, DB.site, site);
        renderBrand();
        toast('设置已保存');
        close();
      } catch (e) { toast(e.message, true); }
    });
  }

  /** 左上角的品牌区跟着「网站设置」走：显示真实的头像和站名 */
  function renderBrand() {
    const name = TW.pick(DB.site.name) || '我的网站';
    $('sideSub').textContent = name;
    const dot = document.querySelector('.sidebar-brand .dot');
    if (!dot) return;
    const logo = DB.site.logo || 'github';
    if (logo === 'github') dot.innerHTML = TW.icon('github');
    else if (logo === 'text' || logo === 'none') dot.textContent = DB.site.logoText || name.charAt(0);
    else dot.innerHTML = '<img src="' + TW.escapeHTML(logo) + '" alt="">';
  }

  /* ---------------------------- 「关于我」页面编辑 ---------------------------- */
  function openAboutEditor() {
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = `
      <div class="modal" style="width:min(760px,100%)">
        <div class="modal-head"><h3>「关于我」页面</h3><button class="btn btn-sm" data-close>关闭</button></div>
        <div class="modal-body">
          <div class="hint" style="margin-bottom:12px">
            这段内容会显示在网站的「关于」页上（首页右上角就能点到）。<br>
            用法和写文章一样：输入 <b>/</b> 唤出菜单，可以放标题、列表、图片。
          </div>
          <div id="aboutEditorBox" style="min-height:280px;border:0.5px solid var(--border-color);border-radius:10px;padding:14px 16px"></div>
        </div>
        <div class="modal-foot">
          <button class="btn" data-close>取消</button>
          <button class="btn btn-primary" id="aboutSave">保存</button>
        </div>
      </div>`;
    document.body.appendChild(mask);

    const close = () => mask.remove();
    mask.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
    mask.addEventListener('click', (e) => { if (e.target === mask) close(); });

    const aboutEd = TWEditor.create(mask.querySelector('#aboutEditorBox'), {
      upload: uploadFile,
      onChange: () => {},
    });
    aboutEd.setHTML(typeof DB.site.about === 'string' ? DB.site.about : TW.pick(DB.site.about) || '');
    aboutEd.focus();

    mask.querySelector('#aboutSave').addEventListener('click', async () => {
      try {
        const about = aboutEd.getHTML();
        await api('/api/site/save', { site: { about } });
        DB.site.about = about;
        toast('已保存！去「关于」页就能看到了');
        close();
      } catch (e) { toast(e.message, true); }
    });
  }

  function brandColor(icon) {
    return ({
      github: '#181717', mail: '#0ea5e9', wechat: '#07c160', bilibili: '#00a1d6',
      zhihu: '#0084ff', x: '#000000', xiaohongshu: '#ff2442', rss: '#f97316',
      book: '#8b5cf6', link: '#334155',
    })[icon] || '#334155';
  }

  /* ---------------------------- 从网页导入文章 ---------------------------- */
  function openImport() {
    if (!current()) { toast('请先新建或选中一篇文章', true); return; }
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = `
      <div class="modal" style="width:min(480px,100%)">
        <div class="modal-head"><h3>从网页导入</h3><button class="btn btn-sm" data-close>关闭</button></div>
        <div class="modal-body">
          <div class="field">
            <label>网址</label>
            <input type="url" id="impUrl" placeholder="https://…">
            <div class="hint">会把那个网页的正文抓下来，清洗成干净的格式放进编辑器。<br>
              抓完记得自己通读一遍再发 —— 转载别人的内容请注明出处。</div>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn" data-close>取消</button>
          <button class="btn btn-primary" id="impGo">开始导入</button>
        </div>
      </div>`;
    document.body.appendChild(mask);
    const close = () => mask.remove();
    mask.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
    mask.addEventListener('click', (e) => { if (e.target === mask) close(); });
    mask.querySelector('#impUrl').focus();

    mask.querySelector('#impGo').addEventListener('click', async () => {
      const url = mask.querySelector('#impUrl').value.trim();
      if (!/^https?:\/\//i.test(url)) { toast('请填一个 http 开头的完整网址', true); return; }
      const btn = mask.querySelector('#impGo');
      btn.disabled = true; btn.textContent = '抓取中…';
      try {
        const res = await api('/api/import', { url });
        const got = extractArticle(res.html, url);
        if (!got.html || TW.countWords(got.text) < 20) {
          throw new Error('没抓到正文 —— 这个页面可能需要登录，或者内容是动态加载的');
        }
        if (got.title && !$('titleInput').value.trim()) {
          $('titleInput').value = got.title;
          autoGrow($('titleInput'));
        }
        const prev = editor.getHTML();
        editor.setHTML((prev ? prev : '') + got.html);
        markDirty();
        const s = updateStats();
        close();
        toast('导入完成，共 ' + s.words + ' 字，正在把图片存到本地…');
        await localizeImages();
        toast('全部搞定！记得通读一遍再发布');
      } catch (e) {
        toast(e.message, true);
        btn.disabled = false; btn.textContent = '开始导入';
      }
    });
  }

  /**
   * 从抓来的整页 HTML 里挑出"正文"那一块。
   * 思路：先扔掉导航/页脚这类干扰，再找文字最集中的那个容器，
   * 然后取"文字量还够多、但层级最深"的那个 —— 这样不会把整页都框进来。
   */
  function extractArticle(html, baseUrl) {
    const doc = new DOMParser().parseFromString(html, 'text/html');

    doc.querySelectorAll('script,style,noscript,iframe,nav,header,footer,aside,form,button,svg,.sidebar,.comment,.comments,.related,.advertisement,[class*="share"],[class*="nav"]')
      .forEach((n) => n.remove());

    // 相对链接转成绝对链接，不然图片全裂
    const abs = (v) => { try { return new URL(v, baseUrl).href; } catch (e) { return v; } };
    doc.querySelectorAll('img').forEach((img) => {
      // 很多站用懒加载，真图藏在 data-src 里
      const real = img.getAttribute('data-src') || img.getAttribute('data-original') ||
                   img.getAttribute('data-lazy-src') || img.getAttribute('src');
      if (real) img.setAttribute('src', abs(real)); else img.remove();
    });
    doc.querySelectorAll('a[href]').forEach((a) => a.setAttribute('href', abs(a.getAttribute('href'))));

    // 找候选容器
    const cands = [...doc.querySelectorAll('article, main, [role="main"], .article, .post, .entry-content, .content, #content, div, section')];
    let maxLen = 0;
    const scored = cands.map((el) => {
      const len = (el.textContent || '').trim().length;
      const ps = el.querySelectorAll('p').length;
      if (ps >= 2 && len > maxLen) maxLen = len;
      return { el, len, ps };
    });

    let best = null;
    if (maxLen > 0) {
      // 文字量还有 55% 以上的候选里，挑最"贴身"（文字最少）的那个
      const ok = scored.filter((c) => c.ps >= 2 && c.len >= maxLen * 0.55);
      ok.sort((a, b) => a.len - b.len);
      best = ok.length ? ok[0].el : null;
    }
    if (!best) best = doc.body;

    const title =
      (doc.querySelector('meta[property="og:title"]') || {}).content ||
      (doc.querySelector('h1') || {}).textContent ||
      (doc.title || '');

    return {
      title: (title || '').trim().slice(0, 120),
      html: TWEditor.sanitize(best.innerHTML),
      text: best.textContent || '',
    };
  }

  /** 把正文里指向外网的图片下载到本地 uploads/，这样断网也能看 */
  async function localizeImages() {
    const imgs = [...editor.root.querySelectorAll('img')].filter((n) => /^https?:/i.test(n.getAttribute('src') || ''));
    if (!imgs.length) return;
    let ok = 0;
    for (const img of imgs) {
      try {
        const r = await api('/api/grab-image', { url: img.getAttribute('src') });
        img.setAttribute('src', r.url);
        ok++;
      } catch (e) { /* 存不下来就保留原网址，图还是能看 */ }
    }
    markDirty();
    if (ok) toast('已把 ' + ok + ' 张图片存到本地');
  }

  /* -------------------------------- 事件 -------------------------------- */
  function bindEvents() {
    $('newBtn').addEventListener('click', createNew);
    $('blankNew').addEventListener('click', createNew);
    $('sideSearch').addEventListener('input', renderList);
    $('siteBtn').addEventListener('click', openSiteSettings);
    $('aboutBtn').addEventListener('click', openAboutEditor);
    $('importBtn').addEventListener('click', openImport);

    $('backupBtn').addEventListener('click', async () => {
      const btn = $('backupBtn');
      btn.disabled = true;
      toast('正在打包备份…');
      try {
        const r = await api('/api/backup', {});
        toast('已备份到「' + r.file + '」（' + r.size + '）');
      } catch (e) { toast(e.message, true); }
      btn.disabled = false;
    });

    ['titleInput', 'summaryInput'].forEach((id) => {
      $(id).addEventListener('input', (e) => {
        autoGrow(e.target);
        const a = current();
        if (id === 'titleInput' && a && !a.cover) { a.title = e.target.value; setCover(''); }
        markDirty();
      });
      // 标题里按回车 = 跳到正文
      $(id).addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && id === 'titleInput') { e.preventDefault(); editor.focus(); }
      });
    });

    ['dateInput', 'pinInput'].forEach((id) => {
      $(id).addEventListener('change', markDirty);
    });

    // 一旦用户自己动了阅读时间，就不再自动覆盖他的数字
    $('rtInput').addEventListener('input', () => {
      const a = current();
      if (a) a.rtManual = true;
      markDirty();
    });

    $('rtAuto').addEventListener('click', () => {
      const a = current();
      if (a) a.rtManual = false;          // 交还给自动计算
      const s = updateStats();
      $('rtInput').value = s.rt;
      markDirty();
      toast('已按 ' + s.words + ' 字重新计算：约 ' + s.rt + ' 分钟');
    });

    $('publishBtn').addEventListener('click', async () => {
      const a = current();
      if (!a) return;
      if (!$('titleInput').value.trim()) { toast('先给文章起个标题吧', true); $('titleInput').focus(); return; }
      a.status = 'published';
      await saveNow();
      updatePublishButtons();
      toast('已发布！去首页就能看到了');
    });

    $('draftBtn').addEventListener('click', async () => {
      const a = current();
      if (!a) return;
      a.status = 'draft';
      await saveNow();
      updatePublishButtons();
      toast('已转为草稿，首页不再显示');
    });

    $('hideBtn').addEventListener('click', async () => {
      const a = current();
      if (!a) return;
      a.hidden = !a.hidden;
      await saveNow();
      updatePublishButtons();
      toast(a.hidden ? '已隐藏，网站上看不到这篇了' : '已取消隐藏，文章重新可见');
    });

    // 预览不落盘：把当前编辑的内容临时塞给阅读页，看的就是没保存的版本
    $('previewBtn').addEventListener('click', () => {
      const a = collect();
      if (!a) return;
      try { localStorage.setItem('tw-preview', JSON.stringify({ id: a.id, a })); } catch (e) {}
      window.open('article.html?id=' + encodeURIComponent(a.id) + '&preview=1', '_blank');
    });

    $('deleteBtn').addEventListener('click', async () => {
      const a = current();
      if (!a) return;
      if (!confirm('确定删除《' + (a.title || '未命名') + '》吗？\n删掉就找不回来了。')) return;
      try {
        try {
          await api('/api/article/delete', { id: a.id });
        } catch (e) {
          if (!/没找到/.test(e.message)) throw e;   // 从没保存过的文章，服务器上本来就没有
        }
        localStorage.removeItem(wipKey(a.id));
        DB.articles = DB.articles.filter((x) => x.id !== a.id);
        currentId = null;
        $('editorPage').hidden = true;
        $('statsBar').hidden = true;
        $('blank').hidden = false;
        renderList();
        toast('已删除');
      } catch (e) { toast(e.message, true); }
    });

    // 保存按钮 / ⌘S：这是唯一会把改动更新到网站的动作
    $('saveBtn').addEventListener('click', () => {
      if (currentId) saveNow().then(() => toast('已保存，网站已更新'));
    });
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (currentId) { saveNow().then(() => toast('已保存，网站已更新')); }
      }
    });

    // 关页面前提醒
    window.addEventListener('beforeunload', (e) => {
      if (dirty) { e.preventDefault(); e.returnValue = ''; }
    });

    $('themeToggle').addEventListener('click', () => {
      const next = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      TW.applyTheme(next);
      localStorage.setItem('tw-theme', next);
    });
  }

  async function createNew() {
    if (dirty) stashNow();
    const a = blankArticle();
    DB.articles.unshift(a);
    currentId = a.id;
    selectArticle(a.id);
    $('titleInput').focus();
    toast('新文章已创建（默认是草稿），写完点「保存」');
  }

  /* -------------------------------- 启动 -------------------------------- */
  async function boot() {
    TW.initTheme();
    TW.initLang(null);

    initCover();
    bindEvents();

    try {
      // 先把密码门过了，再创建编辑器 —— 否则工具栏会浮在密码门之上
      await ensureAuth();

      editor = TWEditor.create($('editor'), {
        upload: uploadFile,
        onChange: () => { updateStats(); markDirty(); },
      });

      const res = await api('/api/db');
      DB = res.db;
      DB.articles = DB.articles || [];

      // 有暂存但还没保存过（服务器上不存在）的新文章，恢复进列表，防止丢稿
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf('tw-wip:') === 0) {
          const id = k.slice(7);
          if (!DB.articles.some((x) => x.id === id)) {
            const wip = readWip(id);
            if (wip && wip.a) DB.articles.unshift(wip.a);
          }
        }
      }

      renderBrand();
      renderList();
      // 自动打开最近编辑的那篇
      const list = sorted();
      if (list.length) selectArticle(list[0].id);
    } catch (e) {
      $('blank').innerHTML =
        '<div style="font-size:44px">🔌</div>' +
        '<h2>后台需要先启动服务器</h2>' +
        '<p>' + TW.escapeHTML(e.message) + '<br><br>' +
        '请回到「唐维西的网站」文件夹，<b>双击「启动.command」</b>，' +
        '然后从弹出的浏览器页面右下角点「写文章」进来。</p>';
      $('blank').hidden = false;
    }
  }

  boot();
})();
