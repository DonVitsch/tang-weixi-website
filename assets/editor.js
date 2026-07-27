/* ============================================================
   TWEditor —— 类 Notion 的可视化编辑器
   -------------------------------------------------------------
   会的事情：
     · 输入 /  唤出块菜单（标题、列表、引用、代码、图片、标注…）
     · 选中文字浮出格式工具条（加粗、斜体、高亮、链接…）
     · Markdown 简写：# 空格变标题、- 空格变列表、> 空格变引用、``` 变代码块
     · 粘贴网页内容自动清洗成干净格式
     · 图片拖进来 / 粘贴 / 选择文件，自动上传到 uploads/
     · 所见即所得：编辑时的排版和读者看到的完全一致
   用法：TWEditor.create(元素, { upload, onChange })
   ============================================================ */
window.TWEditor = (function () {
  'use strict';

  /* --------------------------- 块菜单（斜杠命令） --------------------------- */
  const BLOCKS = [
    { group: '基础', key: 'p',    label: '正文',     desc: '普通段落',              kw: 'zhengwen text p 正文 段落', icon: '¶' },
    { group: '基础', key: 'h1',   label: '大标题',   desc: '一级标题',              kw: 'h1 biaoti 大标题 一级',   icon: 'H₁' },
    { group: '基础', key: 'h2',   label: '中标题',   desc: '二级标题（会进目录）',   kw: 'h2 biaoti 中标题 二级',   icon: 'H₂' },
    { group: '基础', key: 'h3',   label: '小标题',   desc: '三级标题（会进目录）',   kw: 'h3 biaoti 小标题 三级',   icon: 'H₃' },
    { group: '基础', key: 'quote',label: '引用',     desc: '引述别人的话',           kw: 'quote yinyong 引用 引述', icon: '❝' },
    { group: '基础', key: 'callout', label: '标注框', desc: '带图标的重点提示框',    kw: 'callout biaozhu 标注 提示 重点', icon: '💡' },
    { group: '基础', key: 'hr',   label: '分割线',   desc: '一条横线',              kw: 'hr line fengexian 分割线 横线', icon: '—' },
    { group: '列表', key: 'ul',   label: '无序列表', desc: '圆点列表',              kw: 'ul list liebiao 列表 无序 圆点', icon: '•' },
    { group: '列表', key: 'ol',   label: '有序列表', desc: '1. 2. 3. 编号列表',      kw: 'ol list liebiao 列表 有序 数字', icon: '1.' },
    { group: '列表', key: 'todo', label: '待办清单', desc: '可勾选的任务项',         kw: 'todo task daiban 待办 清单 勾选', icon: '☑' },
    { group: '列表', key: 'toggle', label: '折叠列表', desc: '点击展开 / 收起的内容', kw: 'toggle zhedie 折叠 收起 展开 details', icon: '▸' },
    { group: '媒体与数据', key: 'image',label: '图片',   desc: '上传一张图片',        kw: 'image img tupian 图片 照片 插图', icon: '🖼' },
    { group: '媒体与数据', key: 'pre',  label: '代码块', desc: '等宽字体代码',        kw: 'code daima 代码 pre', icon: '‹›' },
    { group: '媒体与数据', key: 'table',label: '表格',   desc: '三行三列表格',        kw: 'table biaoge 表格', icon: '⊞' },
    { group: '媒体与数据', key: 'chart', label: '条形图', desc: '填数据，发布后变成可视化图表', kw: 'chart tubiao 图表 条形图 可视化 数据', icon: '📊' },
    { group: '媒体与数据', key: 'datatable', label: '数据表', desc: '读者可以点表头排序的表格', kw: 'database shujubiao 数据表 数据库 排序', icon: '🗃' },
    { group: '媒体与数据', key: 'bookmark', label: '链接卡片', desc: '把网址变成一张醒目卡片', kw: 'bookmark link lianjie 链接 卡片 书签 网址', icon: '🔖' },
    { group: '插入', key: 'toc',  label: '文章目录', desc: '按文中标题自动生成的目录', kw: 'toc mulu 目录 大纲', icon: '📑' },
    { group: '插入', key: 'emoji', label: '表情符号', desc: '打开表情面板挑一个',     kw: 'emoji biaoqing 表情 符号 emoji', icon: '😀' },
    { group: '插入', key: 'date', label: '今天的日期', desc: '插入一枚日期标签',      kw: 'date riqi 日期 今天 时间', icon: '📅' },
    { group: '插入', key: 'mention', label: '提及文章', desc: '链接到站内的另一篇文章', kw: 'mention tiji 提及 引用文章 站内 链接', icon: '＠' },
  ];

  const CALLOUT_EMOJIS = ['💡', '⚠️', '✅', '📌', '🔥', '❗', '📖', '🎯'];

  /* ------------------------------ 通用小工具 ------------------------------ */
  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function placeCaret(node, atEnd) {
    const sel = window.getSelection();
    const range = document.createRange();
    if (!node) return;
    range.selectNodeContents(node);
    range.collapse(!atEnd);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function swapTag(node, tag) {
    const n = el(tag);
    n.innerHTML = node.innerHTML;
    node.parentNode.replaceChild(n, node);
    return n;
  }

  /* --------------------------- HTML 清洗（公共） --------------------------- */
  const ALLOWED = {
    P: [], BR: [], H1: [], H2: [], H3: [], H4: [], H5: [], H6: [],
    UL: [], OL: [], LI: [], BLOCKQUOTE: [], PRE: [], CODE: [],
    STRONG: [], B: [], EM: [], I: [], U: [], S: [], STRIKE: [], DEL: [], MARK: [],
    A: ['href'], IMG: ['src', 'alt'], FIGURE: [], FIGCAPTION: [], HR: [],
    TABLE: [], THEAD: [], TBODY: [], TR: [], TH: [], TD: [], SPAN: [], DIV: [],
    DETAILS: ['open'], SUMMARY: [],           // 折叠列表
    INPUT: ['type', 'checked', 'disabled'],   // 只为待办清单的勾选框留的口子
  };

  // 编辑器自己产出的结构性 class，从别处复制回来时要保住
  const OWN_CLASSES = [
    'callout', 'callout-emoji', 'callout-body', 'todo', 'todo-text', 'done',
    'article-toc', 'chart-data', 'data-table', 'mention', 'bookmark', 'bm-title', 'bm-url',
  ];

  function ownClassOf(node) {
    const kept = (node.getAttribute('class') || '').split(/\s+/).filter((c) => OWN_CLASSES.indexOf(c) !== -1);
    return kept.length ? kept.join(' ') : '';
  }

  /** 把任意外部 HTML 洗成干净、统一的结构 */
  function sanitize(html) {
    const box = el('div');
    box.innerHTML = html;

    // 1) 整块删掉不要的东西（勾选框除外 —— 待办清单要用）
    box.querySelectorAll('script, style, noscript, iframe, svg, video, audio, form, button, nav, header, footer, aside')
      .forEach((n) => n.remove());
    box.querySelectorAll('input').forEach((n) => {
      if ((n.getAttribute('type') || '').toLowerCase() !== 'checkbox') n.remove();
    });
    // 注释节点也清掉
    [...box.querySelectorAll('*')].concat(box).forEach((n) => {
      [...n.childNodes].forEach((c) => { if (c.nodeType === 8) c.remove(); });
    });

    // 2) 反复给不认识的标签"脱壳"，直到全树只剩白名单标签。
    //    必须循环 —— 脱壳会把里层元素提到外层，那些新提上来的也得再查一遍。
    for (let i = 0; i < 20; i++) {
      const unknown = [...box.querySelectorAll('*')].filter((n) => !ALLOWED[n.tagName]);
      if (!unknown.length) break;
      unknown.forEach((n) => {
        while (n.firstChild) n.parentNode.insertBefore(n.firstChild, n);
        n.remove();
      });
    }

    // 3) 全树剥属性 —— 一个都不放过（我们自己的结构 class 除外）
    box.querySelectorAll('*').forEach((n) => {
      const keep = ALLOWED[n.tagName] || [];
      const own = ownClassOf(n);
      [...n.attributes].forEach((attr) => {
        if (keep.indexOf(attr.name) === -1) n.removeAttribute(attr.name);
      });
      if (own) n.setAttribute('class', own);   // 只保住我们自己的结构 class
    });

    // 4) 标签归一化
    box.querySelectorAll('h4,h5,h6').forEach((h) => swapTag(h, 'h3'));
    box.querySelectorAll('b').forEach((n) => swapTag(n, 'strong'));
    box.querySelectorAll('i').forEach((n) => swapTag(n, 'em'));
    box.querySelectorAll('strike, del').forEach((n) => swapTag(n, 's'));
    box.querySelectorAll('span').forEach((n) => {
      if (ownClassOf(n)) return;                                     // 标注框的图标要留着
      while (n.firstChild) n.parentNode.insertBefore(n.firstChild, n);
      n.remove();
    });
    box.querySelectorAll('div').forEach((n) => {
      if (ownClassOf(n)) return;                                     // 标注框 / 待办项要留着
      if (n.querySelector('p,h1,h2,h3,ul,ol,pre,blockquote,figure,table')) {
        while (n.firstChild) n.parentNode.insertBefore(n.firstChild, n);
        n.remove();
      } else swapTag(n, 'p');
    });
    box.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src') || '';
      if (!/^(https?:|data:image\/|uploads\/|\.\/)/i.test(src)) { img.remove(); return; }
      if (img.closest('figure')) return;
      const f = el('figure');
      img.parentNode.insertBefore(f, img);
      f.appendChild(img);
      f.appendChild(el('figcaption'));
    });
    box.querySelectorAll('a').forEach((a) => {
      const href = a.getAttribute('href') || '';
      if (!/^(https?:|mailto:|#|\/)/i.test(href)) a.removeAttribute('href');
      else { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); }
    });
    box.querySelectorAll('p').forEach((p) => {
      if (!p.textContent.trim() && !p.querySelector('img')) p.remove();
    });

    return box.innerHTML;
  }

  /* ================================ 主体 ================================ */
  function create(root, opts) {
    opts = opts || {};
    const upload = opts.upload || (() => Promise.reject(new Error('未配置上传功能')));
    const onChange = opts.onChange || function () {};

    root.setAttribute('contenteditable', 'true');
    root.setAttribute('spellcheck', 'false');
    root.classList.add('tw-editor', 'prose');

    if (!root.innerHTML.trim()) root.innerHTML = '<p><br></p>';

    /* ---------------------------- 定位与块查询 ---------------------------- */
    function currentBlock() {
      const sel = window.getSelection();
      if (!sel.rangeCount) return null;
      let n = sel.getRangeAt(0).startContainer;
      if (n.nodeType === 3) n = n.parentNode;
      while (n && n.parentNode !== root) n = n.parentNode;
      return n && n !== root ? n : null;
    }

    function closestTag(tagName) {
      const sel = window.getSelection();
      if (!sel.rangeCount) return null;
      let n = sel.getRangeAt(0).startContainer;
      if (n.nodeType === 3) n = n.parentNode;
      while (n && n !== root) {
        if (n.tagName === tagName) return n;
        n = n.parentNode;
      }
      return null;
    }

    function replaceBlock(oldBlock, newBlock) {
      if (!oldBlock || !oldBlock.parentNode) {
        root.appendChild(newBlock);
      } else {
        oldBlock.parentNode.replaceChild(newBlock, oldBlock);
      }
      return newBlock;
    }

    function insertAfter(block, node) {
      if (block && block.nextSibling) root.insertBefore(node, block.nextSibling);
      else root.appendChild(node);
      return node;
    }

    function ensureTrailingParagraph() {
      const last = root.lastElementChild;
      if (!last || ['HR', 'FIGURE', 'PRE', 'TABLE', 'DETAILS', 'A'].indexOf(last.tagName) !== -1 ||
          last.classList.contains('callout') || last.classList.contains('article-toc')) {
        root.appendChild(el('p', '', '<br>'));
      }
    }

    /* ------------------------------ 应用块类型 ------------------------------ */
    function applyBlock(key, keepText) {
      const block = currentBlock();
      const text = keepText === false ? '' : (block ? block.textContent : '');

      switch (key) {
        case 'p':
        case 'h1':
        case 'h2':
        case 'h3': {
          const n = el(key, '', text ? escapeText(text) : '<br>');
          replaceBlock(block, n);
          placeCaret(n, true);
          break;
        }
        case 'quote': {
          const n = el('blockquote', '', '<p>' + (text ? escapeText(text) : '<br>') + '</p>');
          replaceBlock(block, n);
          placeCaret(n.firstElementChild, true);
          break;
        }
        case 'ul':
        case 'ol': {
          const list = el(key === 'ul' ? 'ul' : 'ol');
          const li = el('li', '', text ? escapeText(text) : '<br>');
          list.appendChild(li);
          replaceBlock(block, list);
          placeCaret(li, true);
          break;
        }
        case 'todo': {
          const n = todoNode(text);
          replaceBlock(block, n);
          placeCaret(n.querySelector('.todo-text'), true);
          break;
        }
        case 'callout': {
          const n = calloutNode('💡', text);
          replaceBlock(block, n);
          placeCaret(n.querySelector('.callout-body'), true);
          break;
        }
        case 'pre': {
          const pre = el('pre');
          const code = el('code', '', text ? escapeText(text) : '');
          pre.appendChild(code);
          replaceBlock(block, pre);
          placeCaret(code, true);
          break;
        }
        case 'hr': {
          const hr = el('hr');
          replaceBlock(block, hr);
          const p = insertAfter(hr, el('p', '', '<br>'));
          placeCaret(p, true);
          break;
        }
        case 'table': {
          const t = el('table', '',
            '<thead><tr><th>标题一</th><th>标题二</th><th>标题三</th></tr></thead>' +
            '<tbody><tr><td>　</td><td>　</td><td>　</td></tr><tr><td>　</td><td>　</td><td>　</td></tr></tbody>');
          replaceBlock(block, t);
          const p = insertAfter(t, el('p', '', '<br>'));
          placeCaret(t.querySelector('th'), true);
          break;
        }
        case 'image': {
          pickImage();
          break;
        }
        case 'toggle': {
          const d = el('details', '', '<summary>点我展开</summary><p><br></p>');
          d.setAttribute('open', '');
          replaceBlock(block, d);
          placeCaret(d.querySelector('summary'), true);
          break;
        }
        case 'chart': {
          const t = el('table', 'chart-data',
            '<thead><tr><th>项目</th><th>数值</th></tr></thead>' +
            '<tbody><tr><td>示例 A</td><td>80</td></tr><tr><td>示例 B</td><td>55</td></tr><tr><td>示例 C</td><td>30</td></tr></tbody>');
          replaceBlock(block, t);
          insertAfter(t, el('p', '', '<br>'));
          placeCaret(t.querySelector('td'), true);
          break;
        }
        case 'datatable': {
          const t = el('table', 'data-table',
            '<thead><tr><th>名称</th><th>数量</th><th>备注</th></tr></thead>' +
            '<tbody><tr><td>　</td><td>　</td><td>　</td></tr><tr><td>　</td><td>　</td><td>　</td></tr></tbody>');
          replaceBlock(block, t);
          insertAfter(t, el('p', '', '<br>'));
          placeCaret(t.querySelector('th'), true);
          break;
        }
        case 'toc': {
          const n = el('div', 'article-toc');
          replaceBlock(block, n);
          const p = insertAfter(n, el('p', '', '<br>'));
          placeCaret(p, true);
          break;
        }
        case 'bookmark': {
          const url = window.prompt('要做成卡片的网址：', 'https://');
          if (!url || !/^https?:\/\//i.test(url.trim())) break;
          const u = url.trim();
          let host = u;
          try { host = new URL(u).hostname.replace(/^www\./, ''); } catch (err) { /* 保底用原文 */ }
          const title = window.prompt('卡片标题（留空就用网址）：', '') || host;
          const a = el('a', 'bookmark');
          a.href = u;
          a.setAttribute('contenteditable', 'false');
          a.innerHTML = '<span class="bm-title">' + escapeText(title) + '</span><span class="bm-url">' + escapeText(u) + '</span>';
          if (block && !block.textContent.trim()) replaceBlock(block, a);
          else insertAfter(block, a);
          const p = insertAfter(a, el('p', '', '<br>'));
          placeCaret(p, true);
          break;
        }
        case 'date': {
          const d = new Date();
          const label = `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
          document.execCommand('insertHTML', false,
            '<span class="mention" contenteditable="false">📅 ' + label + '</span>&nbsp;');
          break;
        }
        case 'emoji': {
          openEmojiPanel();
          break;
        }
        case 'mention': {
          openMentionPanel();
          break;
        }
      }
      ensureTrailingParagraph();
      changed();
    }

    function escapeText(s) {
      return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])) || '<br>';
    }

    function todoNode(text) {
      const n = el('div', 'todo');
      n.innerHTML = '<input type="checkbox" contenteditable="false"><span class="todo-text">' + (text ? escapeText(text) : '<br>') + '</span>';
      return n;
    }

    function calloutNode(emoji, text) {
      const n = el('div', 'callout');
      n.innerHTML =
        '<span class="callout-emoji" contenteditable="false" title="点一下换图标">' + emoji + '</span>' +
        '<div class="callout-body">' + (text ? escapeText(text) : '<br>') + '</div>';
      return n;
    }

    /* ------------------------------ 图片处理 ------------------------------ */
    const fileInput = el('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.multiple = true;
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    fileInput.addEventListener('change', () => {
      const files = [...fileInput.files];
      fileInput.value = '';
      files.forEach(insertImageFile);
    });

    function pickImage() { fileInput.click(); }

    function figureNode(url, caption) {
      const f = el('figure');
      f.innerHTML =
        '<img src="' + url + '" alt="" contenteditable="false">' +
        '<figcaption data-placeholder="加一句图片说明（可留空）">' + (caption || '') + '</figcaption>';
      return f;
    }

    function insertImageFile(file) {
      if (!file || !/^image\//.test(file.type)) return;
      const block = currentBlock() || root.lastElementChild;
      const holder = el('figure', 'uploading', '<div class="upload-ph">图片上传中…</div>');
      if (block && block.textContent.trim() === '') replaceBlock(block, holder);
      else insertAfter(block, holder);

      upload(file)
        .then((url) => {
          const f = figureNode(url, '');
          replaceBlock(holder, f);
          const p = insertAfter(f, el('p', '', '<br>'));
          placeCaret(p, true);
          changed();
        })
        .catch((e) => {
          holder.className = 'upload-error';
          holder.innerHTML = '<div class="upload-ph">上传失败：' + (e.message || e) + '</div>';
        });
    }

    /* ------------------------------ 粘贴处理 ------------------------------ */
    root.addEventListener('paste', (e) => {
      const dt = e.clipboardData;
      if (!dt) return;

      // 1) 剪贴板里有图片 → 直接上传
      const imgItem = [...(dt.items || [])].find((it) => it.type && it.type.indexOf('image') === 0);
      if (imgItem) {
        e.preventDefault();
        insertImageFile(imgItem.getAsFile());
        return;
      }

      const html = dt.getData('text/html');
      const text = dt.getData('text/plain');

      // 2) 选中文字时粘贴网址 → 变成超链接
      const sel = window.getSelection();
      if (text && /^https?:\/\/\S+$/i.test(text.trim()) && sel && !sel.isCollapsed) {
        e.preventDefault();
        document.execCommand('createLink', false, text.trim());
        const a = closestTag('A');
        if (a) { a.target = '_blank'; a.rel = 'noopener'; }
        changed();
        return;
      }

      e.preventDefault();
      if (html) {
        document.execCommand('insertHTML', false, sanitize(html));
      } else if (text) {
        // 纯文本按空行分段
        const parts = text.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
        const out = parts.map((p) => '<p>' + escapeText(p).replace(/\n/g, '<br>') + '</p>').join('');
        document.execCommand('insertHTML', false, out || '<p><br></p>');
      }
      ensureTrailingParagraph();
      changed();
      if (opts.onPasteRemoteImages) opts.onPasteRemoteImages(root);
    });

    /* -------------------------- 拖拽图片进来 -------------------------- */
    root.addEventListener('dragover', (e) => {
      if (e.dataTransfer && [...e.dataTransfer.types].indexOf('Files') !== -1) {
        e.preventDefault();
        root.classList.add('drag-over');
      }
    });
    root.addEventListener('dragleave', () => root.classList.remove('drag-over'));
    root.addEventListener('drop', (e) => {
      if (!e.dataTransfer || !e.dataTransfer.files.length) return;
      e.preventDefault();
      root.classList.remove('drag-over');
      [...e.dataTransfer.files].forEach(insertImageFile);
    });

    /* ============================ 斜杠命令菜单 ============================ */
    const menu = el('div', 'tw-slash');
    menu.hidden = true;
    document.body.appendChild(menu);
    let menuOpen = false, menuIndex = 0, menuItems = [], slashAnchor = null;

    function openMenu() {
      menuOpen = true;
      menuIndex = 0;
      slashAnchor = currentBlock();
      renderMenu('');
      menu.hidden = false;
      positionMenu();
    }

    function closeMenu() {
      menuOpen = false;
      menu.hidden = true;
    }

    function renderMenu(query) {
      const q = query.toLowerCase().trim();
      menuItems = BLOCKS.filter((b) =>
        !q || b.label.indexOf(q) !== -1 || b.kw.toLowerCase().indexOf(q) !== -1
      );
      if (!menuItems.length) { closeMenu(); return; }
      if (menuIndex >= menuItems.length) menuIndex = 0;

      // 按分组渲染；组标题只是视觉分隔，键盘导航照旧走扁平列表
      let html = '<div class="tw-slash-hint">选择要插入的内容 · ↑↓ 选择 · 回车确认 · Esc 取消</div>';
      let lastGroup = null;
      menuItems.forEach((b, i) => {
        if (b.group !== lastGroup) {
          html += `<div class="tw-slash-group">${b.group}</div>`;
          lastGroup = b.group;
        }
        html += `<div class="tw-slash-item${i === menuIndex ? ' active' : ''}" data-key="${b.key}">
             <span class="tw-slash-icon">${b.icon}</span>
             <span class="tw-slash-text"><b>${b.label}</b><small>${b.desc}</small></span>
           </div>`;
      });
      menu.innerHTML = html;

      menu.querySelectorAll('.tw-slash-item').forEach((item, i) => {
        item.addEventListener('mouseenter', () => { menuIndex = i; highlight(false); });
        item.addEventListener('mousedown', (e) => { e.preventDefault(); chooseMenu(i); });
      });
    }

    /** fromKeyboard 为 true 时把选中项滚进可视区（鼠标悬停时不滚，不然列表会跳） */
    function highlight(fromKeyboard) {
      menu.querySelectorAll('.tw-slash-item').forEach((n, i) => {
        n.classList.toggle('active', i === menuIndex);
        if (fromKeyboard !== false && i === menuIndex && n.scrollIntoView) {
          n.scrollIntoView({ block: 'nearest' });
        }
      });
    }

    function positionMenu() {
      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      let rect = sel.getRangeAt(0).getBoundingClientRect();
      if (!rect.height && slashAnchor) rect = slashAnchor.getBoundingClientRect();
      const h = menu.offsetHeight || 320;
      const below = window.innerHeight - rect.bottom;
      menu.style.left = Math.min(rect.left, window.innerWidth - 300) + 'px';
      menu.style.top = (below > h + 20 ? rect.bottom + 8 : rect.top - h - 8) + 'px';
    }

    function chooseMenu(i) {
      const item = menuItems[i];
      if (!item) return;
      // 删掉输入的 "/查询词"
      const block = slashAnchor || currentBlock();
      if (block) {
        const txt = block.textContent;
        const at = txt.lastIndexOf('/');
        if (at !== -1) block.textContent = txt.slice(0, at);
        if (!block.textContent) block.innerHTML = '<br>';
        placeCaret(block, true);
      }
      closeMenu();
      applyBlock(item.key);
    }

    /* ============================ 表情符号面板 ============================ */
    const EMOJIS = (
      '😀 😄 😁 😅 🤣 😊 😍 🤩 😎 🤔 🤯 😴 🥳 😭 😤 🫠 🙃 😇 ' +
      '👍 👎 👏 🙌 🤝 💪 🙏 ✌️ 🤘 👀 🧠 ❤️ 🧡 💛 💚 💙 💜 💔 ' +
      '✨ ⭐ 🌟 🔥 💥 ⚡ 🌈 ☀️ 🌙 ☁️ ❄️ 🌸 🌱 🍀 🌊 🎉 🎊 🎁 ' +
      '✅ ❌ ⚠️ ❗ ❓ 💡 📌 📍 🔖 🔗 📎 ✏️ 📝 📖 📚 📅 ⏰ 🧭 ' +
      '💻 🖥 ⌨️ 🖱 📱 📷 🎧 🎮 🛠 🔧 ⚙️ 🧪 🚀 ✈️ 🚗 🏠 🏔 🎯 ' +
      '☕ 🍵 🍜 🍞 🍎 🍊 🍋 🍉 🎂 🍫 🐱 🐶 🐼 🦊 🐣 🦄 🐢 🐟'
    ).split(/\s+/).filter(Boolean);

    const emojiPanel = el('div', 'tw-emoji');
    emojiPanel.hidden = true;
    document.body.appendChild(emojiPanel);

    function openEmojiPanel() {
      emojiPanel.innerHTML = EMOJIS.map((c) => `<button type="button" class="tw-emoji-item">${c}</button>`).join('');
      emojiPanel.hidden = false;
      positionPanel(emojiPanel);
      emojiPanel.querySelectorAll('.tw-emoji-item').forEach((b) => {
        // mousedown 防止编辑器丢失光标，插入才会落在原位置
        b.addEventListener('mousedown', (e) => {
          e.preventDefault();
          document.execCommand('insertText', false, b.textContent);
          emojiPanel.hidden = true;
          changed();
        });
      });
    }

    /* ============================ 提及文章面板 ============================ */
    const mentionPanel = el('div', 'tw-mention');
    mentionPanel.hidden = true;
    document.body.appendChild(mentionPanel);

    function openMentionPanel() {
      const list = (opts.articles ? opts.articles() : [])
        .filter((a) => a.status !== 'draft')
        .slice(0, 50);
      if (!list.length) {
        window.alert('还没有已发布的文章可以提及');
        return;
      }
      const row = (a) => `
        <div class="tw-mention-item" data-id="${a.id}" data-title="${escapeText(a.title || '未命名')}">
          <span class="tw-mention-t">${escapeText(a.title || '未命名')}</span>
          <span class="tw-mention-d">${a.date || ''}</span>
        </div>`;
      mentionPanel.innerHTML =
        '<input class="tw-mention-search" placeholder="搜文章标题…">' +
        '<div class="tw-mention-list">' + list.map(row).join('') + '</div>';
      mentionPanel.hidden = false;
      positionPanel(mentionPanel);

      const doInsert = (item) => {
        mentionPanel.hidden = true;
        root.focus();
        document.execCommand('insertHTML', false,
          '<a class="mention" contenteditable="false" href="article.html?id=' + encodeURIComponent(item.dataset.id) + '">📄 ' +
          escapeText(item.dataset.title) + '</a>&nbsp;');
        changed();
      };
      mentionPanel.querySelectorAll('.tw-mention-item').forEach((item) => {
        item.addEventListener('mousedown', (e) => { e.preventDefault(); doInsert(item); });
      });
      const search = mentionPanel.querySelector('.tw-mention-search');
      search.addEventListener('input', () => {
        const q = search.value.trim().toLowerCase();
        mentionPanel.querySelectorAll('.tw-mention-item').forEach((item) => {
          item.hidden = q && item.dataset.title.toLowerCase().indexOf(q) === -1;
        });
      });
      search.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { mentionPanel.hidden = true; root.focus(); }
        if (e.key === 'Enter') {
          e.preventDefault();
          const first = [...mentionPanel.querySelectorAll('.tw-mention-item')].find((n) => !n.hidden);
          if (first) doInsert(first);
        }
      });
      setTimeout(() => search.focus(), 0);
    }

    /** 把浮动面板摆到光标附近（放不下就翻到上面） */
    function positionPanel(panel) {
      const sel = window.getSelection();
      let rect = sel.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null;
      if ((!rect || !rect.height) && currentBlock()) rect = currentBlock().getBoundingClientRect();
      if (!rect) rect = root.getBoundingClientRect();
      const h = panel.offsetHeight || 260;
      const w = panel.offsetWidth || 300;
      panel.style.left = Math.max(10, Math.min(rect.left, window.innerWidth - w - 10)) + 'px';
      panel.style.top = (window.innerHeight - rect.bottom > h + 20 ? rect.bottom + 8 : rect.top - h - 8) + 'px';
    }

    document.addEventListener('mousedown', (e) => {
      if (!emojiPanel.hidden && !emojiPanel.contains(e.target)) emojiPanel.hidden = true;
      if (!mentionPanel.hidden && !mentionPanel.contains(e.target)) mentionPanel.hidden = true;
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { emojiPanel.hidden = true; mentionPanel.hidden = true; }
    });

    /* ============================ 选中格式工具条 ============================ */
    const bar = el('div', 'tw-toolbar');
    bar.hidden = true;
    bar.innerHTML = [
      btn('bold', '<b>B</b>', '加粗 ⌘B'),
      btn('italic', '<i>I</i>', '斜体 ⌘I'),
      btn('underline', '<u>U</u>', '下划线 ⌘U'),
      btn('strike', '<s>S</s>', '删除线'),
      '<span class="tw-sep"></span>',
      btn('mark', '<span style="background:#fde68a;padding:0 3px;border-radius:3px">A</span>', '高亮'),
      btn('code', '<code>&lt;&gt;</code>', '行内代码'),
      btn('link', '🔗', '加链接 ⌘K'),
      '<span class="tw-sep"></span>',
      btn('h2', 'H2', '设为中标题'),
      btn('h3', 'H3', '设为小标题'),
      btn('quote', '❝', '设为引用'),
      btn('clear', '⌫', '清除格式'),
    ].join('');
    document.body.appendChild(bar);

    function btn(cmd, label, title) {
      return `<button type="button" class="tw-tb" data-cmd="${cmd}" title="${title}">${label}</button>`;
    }

    bar.addEventListener('mousedown', (e) => e.preventDefault()); // 防止选区丢失
    bar.addEventListener('click', (e) => {
      const b = e.target.closest('.tw-tb');
      if (!b) return;
      runCommand(b.dataset.cmd);
    });

    function runCommand(cmd) {
      switch (cmd) {
        case 'bold': document.execCommand('bold'); break;
        case 'italic': document.execCommand('italic'); break;
        case 'underline': document.execCommand('underline'); break;
        case 'strike': document.execCommand('strikeThrough'); break;
        case 'mark': toggleWrap('MARK'); break;
        case 'code': toggleWrap('CODE'); break;
        case 'link': makeLink(); break;
        case 'h2': applyBlock('h2'); break;
        case 'h3': applyBlock('h3'); break;
        case 'quote': applyBlock('quote'); break;
        case 'clear':
          document.execCommand('removeFormat');
          unwrap('MARK'); unwrap('CODE');
          break;
      }
      changed();
      updateToolbar();
    }

    function toggleWrap(tag) {
      const existing = closestTag(tag);
      if (existing) { unwrapNode(existing); return; }
      const sel = window.getSelection();
      if (!sel.rangeCount || sel.isCollapsed) return;
      const range = sel.getRangeAt(0);
      const node = document.createElement(tag);
      try {
        node.appendChild(range.extractContents());
        range.insertNode(node);
        placeCaret(node, true);
      } catch (e) { /* 跨块选择时忽略 */ }
    }

    function unwrap(tag) {
      const n = closestTag(tag);
      if (n) unwrapNode(n);
    }

    function unwrapNode(n) {
      const parent = n.parentNode;
      while (n.firstChild) parent.insertBefore(n.firstChild, n);
      parent.removeChild(n);
    }

    function makeLink() {
      const existing = closestTag('A');
      const current = existing ? existing.getAttribute('href') : '';
      const url = window.prompt('输入链接地址（留空则取消链接）：', current || 'https://');
      if (url === null) return;
      if (!url.trim()) { if (existing) unwrapNode(existing); return; }
      document.execCommand('createLink', false, url.trim());
      const a = closestTag('A') || existing;
      if (a) { a.target = '_blank'; a.rel = 'noopener'; }
    }

    function updateToolbar() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount || !root.contains(sel.anchorNode)) {
        bar.hidden = true;
        return;
      }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (!rect.width && !rect.height) { bar.hidden = true; return; }
      bar.hidden = false;
      const w = bar.offsetWidth || 380;
      bar.style.left = Math.max(10, Math.min(rect.left + rect.width / 2 - w / 2, window.innerWidth - w - 10)) + 'px';
      bar.style.top = (rect.top > 70 ? rect.top - bar.offsetHeight - 10 : rect.bottom + 10) + 'px';

      ['bold', 'italic', 'underline'].forEach((c) => {
        const b = bar.querySelector('[data-cmd="' + c + '"]');
        if (b) b.classList.toggle('on', document.queryCommandState(c));
      });
      bar.querySelector('[data-cmd="mark"]').classList.toggle('on', !!closestTag('MARK'));
      bar.querySelector('[data-cmd="code"]').classList.toggle('on', !!closestTag('CODE'));
      bar.querySelector('[data-cmd="link"]').classList.toggle('on', !!closestTag('A'));
    }

    document.addEventListener('selectionchange', () => {
      if (document.activeElement !== root) { bar.hidden = true; return; }
      updateToolbar();
    });

    /* ============================== 键盘处理 ============================== */
    root.addEventListener('keydown', (e) => {
      /* 菜单打开时，方向键由菜单接管 */
      if (menuOpen) {
        if (e.key === 'ArrowDown') { e.preventDefault(); menuIndex = (menuIndex + 1) % menuItems.length; highlight(); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); menuIndex = (menuIndex - 1 + menuItems.length) % menuItems.length; highlight(); return; }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); chooseMenu(menuIndex); return; }
        if (e.key === 'Escape') { e.preventDefault(); closeMenu(); return; }
      }

      const meta = e.metaKey || e.ctrlKey;

      /* 快捷键 */
      if (meta && e.key.toLowerCase() === 'k') { e.preventDefault(); makeLink(); changed(); return; }
      if (meta && e.shiftKey && e.key.toLowerCase() === 'h') { e.preventDefault(); runCommand('mark'); return; }
      if (meta && e.key >= '1' && e.key <= '3') { e.preventDefault(); applyBlock('h' + e.key); return; }
      if (meta && e.key === '0') { e.preventDefault(); applyBlock('p'); return; }

      /* 代码块里回车不跳出，Tab 缩进 */
      const pre = closestTag('PRE');
      if (pre) {
        if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '  '); return; }
        if (e.key === 'Enter' && !e.shiftKey && !meta) {
          e.preventDefault();
          document.execCommand('insertText', false, '\n');
          return;
        }
        if (e.key === 'Enter' && meta) {   // ⌘回车 = 跳出代码块
          e.preventDefault();
          const p = insertAfter(pre, el('p', '', '<br>'));
          placeCaret(p, true);
          changed();
          return;
        }
      }

      /* 折叠列表：标题行回车 = 进入内容区；内容区最后一个空行回车 = 跳出 */
      const summary = closestTag('SUMMARY');
      if (summary && e.key === 'Enter') {
        e.preventDefault();
        const details = summary.parentNode;
        let body = summary.nextElementSibling;
        if (!body) { body = el('p', '', '<br>'); details.appendChild(body); }
        details.setAttribute('open', '');
        placeCaret(body, true);
        return;
      }
      const details = closestTag('DETAILS');
      if (details && e.key === 'Enter' && !e.shiftKey) {
        const blockInDetails = window.getSelection().rangeCount
          ? window.getSelection().getRangeAt(0).startContainer : null;
        let n = blockInDetails && blockInDetails.nodeType === 3 ? blockInDetails.parentNode : blockInDetails;
        while (n && n.parentNode !== details) n = n.parentNode;
        if (n && n === details.lastElementChild && !n.textContent.trim()) {
          e.preventDefault();
          n.remove();
          const p = insertAfter(details, el('p', '', '<br>'));
          placeCaret(p, true);
          changed();
          return;
        }
      }

      /* 回车：从标题/待办/标注继续时回到正文 */
      if (e.key === 'Enter' && !e.shiftKey) {
        const block = currentBlock();
        if (!block) return;

        if (/^H[1-3]$/.test(block.tagName)) {
          e.preventDefault();
          const p = insertAfter(block, el('p', '', '<br>'));
          placeCaret(p, true);
          changed();
          return;
        }
        if (block.classList && block.classList.contains('todo')) {
          e.preventDefault();
          if (!block.textContent.trim()) {           // 空待办项 → 退回正文
            const p = replaceBlock(block, el('p', '', '<br>'));
            placeCaret(p, true);
          } else {
            const n = insertAfter(block, todoNode(''));
            placeCaret(n.querySelector('.todo-text'), true);
          }
          changed();
          return;
        }
        if (block.classList && block.classList.contains('callout')) {
          const body = block.querySelector('.callout-body');
          if (body && !body.textContent.trim()) {
            e.preventDefault();
            const p = insertAfter(block, el('p', '', '<br>'));
            placeCaret(p, true);
            changed();
            return;
          }
        }
      }

      /* 退格：在块开头把特殊块变回正文 */
      if (e.key === 'Backspace') {
        const sel = window.getSelection();
        const block = currentBlock();
        if (block && sel.isCollapsed && sel.anchorOffset === 0) {
          const atStart = isCaretAtBlockStart(block);
          if (atStart) {
            if (/^(H1|H2|H3|BLOCKQUOTE|PRE)$/.test(block.tagName) ||
                (block.classList && (block.classList.contains('todo') || block.classList.contains('callout')))) {
              e.preventDefault();
              const p = replaceBlock(block, el('p', '', block.textContent ? escapeText(block.textContent) : '<br>'));
              placeCaret(p, false);
              changed();
              return;
            }
          }
        }
      }
    });

    function isCaretAtBlockStart(block) {
      const sel = window.getSelection();
      if (!sel.rangeCount) return false;
      const r = sel.getRangeAt(0).cloneRange();
      r.selectNodeContents(block);
      r.setEnd(sel.getRangeAt(0).startContainer, sel.getRangeAt(0).startOffset);
      return r.toString().length === 0;
    }

    /* ------------------------ 输入监听：/ 菜单 + Markdown ------------------------ */
    root.addEventListener('input', () => {
      const block = currentBlock();

      /* 斜杠菜单开关 */
      if (block) {
        const text = block.textContent;
        const slashAt = text.lastIndexOf('/');
        if (!menuOpen && slashAt !== -1 && slashAt === text.length - 1 && block.tagName !== 'PRE') {
          openMenu();
        } else if (menuOpen) {
          if (slashAt === -1) closeMenu();
          else { renderMenu(text.slice(slashAt + 1)); positionMenu(); }
        }
      }

      /* Markdown 简写 */
      if (!menuOpen && block && block.tagName === 'P') {
        const t = block.textContent;
        const rules = [
          [/^#\s/, 'h1'], [/^##\s/, 'h2'], [/^###\s/, 'h3'],
          [/^[-*+]\s/, 'ul'], [/^1[.、]\s/, 'ol'],
          [/^>\s/, 'quote'], [/^\[\]\s/, 'todo'], [/^```$/, 'pre'],
          [/^(---|===|\*\*\*)$/, 'hr'],
        ];
        for (const [re, key] of rules) {
          if (re.test(t)) {
            block.textContent = t.replace(re, '');
            applyBlock(key, key !== 'pre' && key !== 'hr');
            return;
          }
        }
      }
      changed();
    });

    /* -------------------------- 标注框换图标 & 待办勾选 -------------------------- */
    root.addEventListener('click', (e) => {
      const emoji = e.target.closest('.callout-emoji');
      if (emoji) {
        const i = CALLOUT_EMOJIS.indexOf(emoji.textContent.trim());
        emoji.textContent = CALLOUT_EMOJIS[(i + 1) % CALLOUT_EMOJIS.length];
        changed();
        return;
      }
      const cb = e.target.closest('.todo input');
      if (cb) {
        const item = cb.closest('.todo');
        setTimeout(() => { item.classList.toggle('done', cb.checked); changed(); }, 0);
      }
    });

    document.addEventListener('mousedown', (e) => {
      if (menuOpen && !menu.contains(e.target)) closeMenu();
    });

    /* -------------------------------- 输出 -------------------------------- */
    let changeTimer;
    function changed() {
      clearTimeout(changeTimer);
      changeTimer = setTimeout(() => onChange(getHTML()), 200);
      paintPlaceholders();
    }

    function paintPlaceholders() {
      root.querySelectorAll('p, h1, h2, h3, li').forEach((n) => {
        n.toggleAttribute('data-empty', !n.textContent.trim());
      });
    }

    /** 导出干净的 HTML（去掉编辑器专用的临时状态） */
    function getHTML() {
      const box = el('div');
      box.innerHTML = root.innerHTML;
      box.querySelectorAll('[data-empty]').forEach((n) => n.removeAttribute('data-empty'));
      box.querySelectorAll('.uploading, .upload-error').forEach((n) => n.remove());
      box.querySelectorAll('[contenteditable]').forEach((n) => n.removeAttribute('contenteditable'));
      box.querySelectorAll('figcaption').forEach((n) => {
        n.removeAttribute('data-placeholder');
        if (!n.textContent.trim()) n.remove();
      });
      box.querySelectorAll('.todo input').forEach((n) => {
        n.setAttribute('disabled', '');
        if (n.checked) n.setAttribute('checked', '');
      });
      // 目录块的内容由阅读页按标题自动生成，底稿里只留空壳
      box.querySelectorAll('.article-toc').forEach((n) => { n.innerHTML = ''; });
      // 去掉末尾多余空段落
      let last = box.lastElementChild;
      while (last && last.tagName === 'P' && !last.textContent.trim() && !last.querySelector('img')) {
        last.remove();
        last = box.lastElementChild;
      }
      return box.innerHTML.trim();
    }

    function setHTML(html) {
      root.innerHTML = html && html.trim() ? html : '<p><br></p>';
      root.querySelectorAll('figcaption').forEach((n) => n.setAttribute('data-placeholder', '加一句图片说明（可留空）'));
      root.querySelectorAll('.todo input').forEach((n) => {
        n.removeAttribute('disabled');
        n.setAttribute('contenteditable', 'false');
      });
      root.querySelectorAll('img').forEach((n) => n.setAttribute('contenteditable', 'false'));
      root.querySelectorAll('.callout-emoji').forEach((n) => n.setAttribute('contenteditable', 'false'));
      root.querySelectorAll('.mention, a.bookmark').forEach((n) => n.setAttribute('contenteditable', 'false'));
      root.querySelectorAll('details').forEach((n) => n.setAttribute('open', ''));   // 编辑时全展开，免得内容藏着改不到
      ensureTrailingParagraph();
      paintPlaceholders();
    }

    paintPlaceholders();

    return {
      root, getHTML, setHTML,
      focus: () => root.focus(),
      insertImageFile,
      applyBlock,
      getText: () => root.textContent || '',
    };
  }

  return { create, BLOCKS, sanitize };
})();
