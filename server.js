/**
 * 唐维西的网站 —— 本地小服务器
 * 零依赖，只用 Node.js 自带功能。负责三件事：
 *   1. 把网页文件发给浏览器（静态服务）
 *   2. 接收后台保存的文章，写进 data/ 文件夹
 *   3. 接收上传的图片，存进 uploads/ 文件夹
 *
 * 真实数据只存在 data/db.json 一个文件里（这是"底稿"）。
 * 每次保存后，服务器会自动把底稿"编译"成网页能直接读的 .js 文件，
 * 这样即使不开服务器、直接双击 index.html 也能正常浏览。
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const POSTS_DIR = path.join(DATA_DIR, 'posts');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PASS_FILE = path.join(DATA_DIR, 'admin-pass.json');
const TOKEN_FILE = path.join(DATA_DIR, 'auth-tokens.json');

const START_PORT = 4321;
const MAX_BODY = 40 * 1024 * 1024; // 单次请求最大 40MB（够传很大的图了）

/* ---------------------------------- 工具 ---------------------------------- */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.md': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.zip': 'application/zip',
};

function ensureDirs() {
  [DATA_DIR, POSTS_DIR, UPLOAD_DIR].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}

function defaultDB() {
  return {
    site: {
      name: { zh: '唐维西', en: 'Tang Weixi' },
      tagline: {
        zh: '技术探索与个人随笔 · 把想清楚的事写下来',
        en: 'Notes on technology and life',
      },
      logo: 'github',            // 'github' | 'text' | 'none' | 上传图片的路径
      logoText: '唐',
      url: '',                   // 网站正式上线后的网址（用于 RSS / 站点地图），本地用可留空
      about: '',                 // 「关于我」页面的正文（在后台编辑）
      footer: { zh: '© 2026 唐维西', en: '© 2026 Tang Weixi' },
      links: [
        { name: 'GitHub', url: 'https://github.com/', icon: 'github', color: '#181717', action: 'open' },
        { name: '邮箱', url: 'hello@example.com', icon: 'mail', color: '#0ea5e9', action: 'copy' },
      ],
      tags: ['技术', '随笔', '工具', '思考'],
      friends: [],               // 友链：[{ name, url, desc }]，在后台「网站设置」里编辑
    },
    articles: [],
  };
}

function readDB() {
  ensureDirs();
  if (!fs.existsSync(DB_FILE)) {
    const db = defaultDB();
    writeDB(db);
    return db;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    // 底稿坏了就备份一份，重新来过，绝不静默丢数据
    const backup = DB_FILE + '.broken-' + Date.now();
    fs.copyFileSync(DB_FILE, backup);
    console.error('⚠️  data/db.json 解析失败，已备份为 ' + path.basename(backup));
    const db = defaultDB();
    writeDB(db);
    return db;
  }
}

function writeDB(db) {
  ensureDirs();
  // 先写临时文件再改名，避免写一半断电导致文件损坏
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, DB_FILE);
  build(db);
}

/* -------------------------------- 管理员密码 --------------------------------
   密码只存加盐哈希，放在 data/admin-pass.json。
   忘记密码：删掉这个文件、重启服务器，后台会让你重新设一个。
   登录成功发一个令牌，存在 data/auth-tokens.json，30 天内不用重复输密码。 */

const TOKEN_TTL = 30 * 24 * 3600 * 1000;

// scrypt：专门为「就算哈希文件泄露也难暴力破解」设计的算法。
// 每算一次都要占大量内存和时间，攻击者想逐个试密码会非常昂贵。
const SCRYPT_OPTS = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function hashPassLegacy(pw, salt) {
  return crypto.createHash('sha256').update(salt + ':' + pw).digest('hex');
}

function hashPass(pw, salt) {
  return crypto.scryptSync(pw, salt, 32, SCRYPT_OPTS).toString('hex');
}

function passIsSet() { return fs.existsSync(PASS_FILE); }

function setPass(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  ensureDirs();
  fs.writeFileSync(PASS_FILE, JSON.stringify({ algo: 'scrypt', salt, hash: hashPass(pw, salt) }, null, 2), 'utf8');
}

function checkPass(pw) {
  try {
    const rec = JSON.parse(fs.readFileSync(PASS_FILE, 'utf8'));
    const calc = rec.algo === 'scrypt' ? hashPass(pw, rec.salt) : hashPassLegacy(pw, rec.salt);
    const got = Buffer.from(calc, 'hex');
    const want = Buffer.from(rec.hash, 'hex');
    const ok = got.length === want.length && crypto.timingSafeEqual(got, want);
    // 老格式（单轮 sha256）的密码验证通过后，顺手升级成 scrypt，用户无感
    if (ok && rec.algo !== 'scrypt') setPass(pw);
    return ok;
  } catch (e) { return false; }
}

function readTokens() {
  try { return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')); } catch (e) { return {}; }
}

function issueToken() {
  const tokens = readTokens();
  const now = Date.now();
  Object.keys(tokens).forEach((t) => { if (tokens[t] < now) delete tokens[t]; });
  const t = crypto.randomBytes(24).toString('hex');
  tokens[t] = now + TOKEN_TTL;
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens), 'utf8');
  return t;
}

function tokenValid(req) {
  const t = req.headers['x-auth-token'];
  if (!t) return false;
  const exp = readTokens()[t];
  return !!exp && exp > Date.now();
}

/** 把底稿编译成网页可直接 <script> 引入的文件 */
function build(db) {
  ensureDirs();
  const site = db.site || defaultDB().site;
  fs.writeFileSync(
    path.join(DATA_DIR, 'site.js'),
    '/* 自动生成，请勿手改 —— 改内容请打开后台 */\nwindow.SITE = ' + JSON.stringify(site, null, 2) + ';\n',
    'utf8'
  );

  // 首页只需要摘要信息，不带正文，这样文章再多首页也很快
  // 草稿和被隐藏的文章都不进公开列表（也自然不进 RSS 和站点地图）
  const index = (db.articles || [])
    .filter((a) => a.status !== 'draft' && !a.hidden)
    .map((a) => {
      const { content, contentEn, ...meta } = a;
      return meta;
    })
    .sort(sortArticles);

  fs.writeFileSync(
    path.join(DATA_DIR, 'articles.js'),
    '/* 自动生成，请勿手改 */\nwindow.ARTICLES = ' + JSON.stringify(index, null, 2) + ';\n',
    'utf8'
  );

  // 每篇文章的正文单独一个文件。
  // 草稿不生成 —— 这些文件将来会跟着网站一起传到网上，
  // 草稿只该活在 db.json（不外发）里；预览走的是浏览器本地暂存，不受影响。
  // 「隐藏」的文章仍然生成：它的定位是"列表里不出现，知道链接的人能看"。
  const validIds = new Set();
  (db.articles || []).forEach((a) => {
    if (a.status === 'draft') return;
    validIds.add(a.id);
    fs.writeFileSync(
      path.join(POSTS_DIR, a.id + '.js'),
      '/* 自动生成，请勿手改 */\nwindow.__POST__ = ' + JSON.stringify(a, null, 2) + ';\n',
      'utf8'
    );
  });

  // 清掉已删除文章残留的正文文件
  fs.readdirSync(POSTS_DIR).forEach((f) => {
    if (f.endsWith('.js') && !validIds.has(f.slice(0, -3))) {
      fs.unlinkSync(path.join(POSTS_DIR, f));
    }
  });

  buildFeedAndSitemap(db, index);
}

/* ------------------------- RSS / 站点地图 / robots ------------------------- */

function xmlEscape(s) {
  return String(s == null ? '' : s).replace(/[<>&"']/g, (c) => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]
  ));
}

/** 双语字段（{zh,en} 或纯字符串）统一取中文优先的字符串 */
function pickText(field) {
  if (field == null) return '';
  if (typeof field === 'string') return field;
  return field.zh || field.en || '';
}

/**
 * 生成 feed.xml（RSS 订阅）、sitemap.xml、robots.txt。
 * 网站设置里填了「正式网址」后，链接才是完整的；没填时先用相对路径占位，
 * 本地浏览不受影响，上线前在后台补上网址即可。
 */
function buildFeedAndSitemap(db, index) {
  const site = db.site || {};
  const base = String(site.url || '').trim().replace(/\/+$/, '');
  const name = pickText(site.name) || '我的网站';
  const desc = pickText(site.tagline) || '';
  const articleLink = (a) => base + '/article.html?id=' + encodeURIComponent(a.id);
  const rfc822 = (iso) => {
    const d = new Date(String(iso || '') + 'T08:00:00+08:00');
    return isNaN(d) ? new Date().toUTCString() : d.toUTCString();
  };

  // RSS：最新 30 篇，带全文
  const items = index.slice(0, 30).map((a) => {
    const post = (db.articles || []).find((x) => x.id === a.id) || {};
    let content = String(post.content || '').replace(/]]>/g, ']]&gt;');
    // 订阅阅读器不在网站里打开文章，相对路径的图片会裂 —— 填了正式网址就转成绝对地址
    if (base) content = content.replace(/(src|href)="(uploads\/[^"]+)"/g, `$1="${base}/$2"`);
    return [
      '  <item>',
      '    <title>' + xmlEscape(pickText(a.title)) + '</title>',
      '    <link>' + xmlEscape(a.externalUrl || articleLink(a)) + '</link>',
      '    <guid isPermaLink="false">' + xmlEscape(a.id) + '</guid>',
      '    <pubDate>' + rfc822(a.date) + '</pubDate>',
      '    <description><![CDATA[' + (pickText(a.summary) || '') + ']]></description>',
      content ? '    <content:encoded><![CDATA[' + content + ']]></content:encoded>' : '',
      '  </item>',
    ].filter(Boolean).join('\n');
  }).join('\n');

  // 全站最近一次更新的日期（置顶文章不一定是最新的，所以要遍历取最大值）
  const latest = index.map((a) => a.updated || a.date).filter(Boolean).sort().pop();
  const rss = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">',
    '<channel>',
    '  <title>' + xmlEscape(name) + '</title>',
    '  <link>' + xmlEscape(base || '/') + '</link>',
    '  <description>' + xmlEscape(desc) + '</description>',
    '  <language>zh-cn</language>',
    latest ? '  <lastBuildDate>' + rfc822(latest) + '</lastBuildDate>' : '',
    base ? '  <atom:link href="' + xmlEscape(base + '/feed.xml') + '" rel="self" type="application/rss+xml"/>' : '',
    items,
    '</channel>',
    '</rss>',
    '',
  ].filter((l) => l !== '').join('\n');
  fs.writeFileSync(path.join(ROOT, 'feed.xml'), rss, 'utf8');

  // 站点地图：固定页面 + 每篇文章
  const pages = ['', 'about.html', 'archive.html', 'links.html'];
  const urls = pages.map((p) => '  <url><loc>' + xmlEscape(base + '/' + p) + '</loc></url>')
    .concat(index.filter((a) => !a.externalUrl).map((a) =>
      '  <url><loc>' + xmlEscape(articleLink(a)) + '</loc>' +
      (a.updated || a.date ? '<lastmod>' + xmlEscape(a.updated || a.date) + '</lastmod>' : '') + '</url>'));
  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls.join('\n'),
    '</urlset>',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap, 'utf8');

  // robots.txt：欢迎抓取，但后台页面不用收录
  const robots = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin.html',
    base ? 'Sitemap: ' + base + '/sitemap.xml' : '',
  ].filter(Boolean).join('\n') + '\n';
  fs.writeFileSync(path.join(ROOT, 'robots.txt'), robots, 'utf8');
}

function sortArticles(a, b) {
  // 置顶永远排在最前；同为置顶/非置顶时，日期新→旧
  if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
  return String(b.date || '').localeCompare(String(a.date || ''));
}

function send(res, code, body, type) {
  res.writeHead(code, {
    'Content-Type': type || 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendJSON(res, code, obj) {
  send(res, code, JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('内容太大了（超过 40MB），如果是图片请先压缩一下'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(new Error('请求格式不对：' + e.message));
      }
    });
    req.on('error', reject);
  });
}

/* --------------------------------- 接口逻辑 -------------------------------- */

const EXT_BY_MIME = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/avif': '.avif',
};

function saveUpload(payload) {
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(payload.dataUrl || '');
  if (!m) throw new Error('图片数据不完整');
  const mime = m[1];
  const ext = EXT_BY_MIME[mime];
  if (!ext) throw new Error('只支持 png / jpg / gif / webp / svg 格式的图片');

  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 20 * 1024 * 1024) throw new Error('图片超过 20MB，请压缩后再传');

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 8);
  const safeName = String(payload.name || 'img')
    .replace(/\.[^.]*$/, '')
    .replace(/[^\w一-龥-]/g, '')
    .slice(0, 24) || 'img';
  const filename = `${stamp}-${safeName}-${rand}${ext}`;

  ensureDirs();
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buf);
  return 'uploads/' + filename;
}

/* ---------------------------- 抓取远程网页 / 图片 ---------------------------- */

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

function assertHttpUrl(raw) {
  let u;
  try { u = new URL(raw); } catch (e) { throw new Error('网址格式不对'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('只支持 http / https 网址');
  return u;
}

async function fetchPage(raw) {
  const u = assertHttpUrl(raw);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(u.href, { headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9' }, signal: ctrl.signal, redirect: 'follow' });
    if (!r.ok) throw new Error('对方网站返回了 ' + r.status + '，可能需要登录或不允许抓取');
    const type = r.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml/i.test(type)) throw new Error('这个网址不是网页（' + type.split(';')[0] + '）');
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 8 * 1024 * 1024) throw new Error('网页太大了，抓不动');
    // 优先按 UTF-8 解码；如果页面自称 gbk 就换一种
    let text = buf.toString('utf8');
    const charset = (type.match(/charset=([\w-]+)/i) || text.match(/charset=["']?([\w-]+)/i) || [])[1];
    if (charset && !/utf-?8/i.test(charset)) {
      try { text = new TextDecoder(charset.toLowerCase()).decode(buf); } catch (e) { /* 解不了就用原来的 */ }
    }
    return text;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('抓取超时（20 秒），对方网站可能太慢或打不开');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function grabRemoteImage(raw) {
  const u = assertHttpUrl(raw);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(u.href, { headers: { 'User-Agent': UA, Referer: u.origin }, signal: ctrl.signal });
    if (!r.ok) throw new Error('图片下载失败（' + r.status + '）');
    const mime = (r.headers.get('content-type') || '').split(';')[0];
    if (!EXT_BY_MIME[mime]) throw new Error('不支持的图片格式：' + mime);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 20 * 1024 * 1024) throw new Error('图片超过 20MB');
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `${stamp}-web-${Math.random().toString(36).slice(2, 8)}${EXT_BY_MIME[mime]}`;
    ensureDirs();
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), buf);
    return 'uploads/' + filename;
  } finally {
    clearTimeout(timer);
  }
}

async function handleAPI(req, res, pathname) {
  /* —— 不需要登录的接口：查询登录状态、设密码、登录 —— */
  if (pathname === '/api/auth/status') {
    return sendJSON(res, 200, { ok: true, set: passIsSet(), authed: tokenValid(req) });
  }
  if (req.method === 'POST' && pathname === '/api/auth/setup') {
    const body = await readBody(req);
    if (passIsSet()) return sendJSON(res, 403, { ok: false, error: '密码已经设置过了' });
    const pw = String(body.password || '');
    if (pw.length < 4) return sendJSON(res, 400, { ok: false, error: '密码至少要 4 位' });
    setPass(pw);
    return sendJSON(res, 200, { ok: true, token: issueToken() });
  }
  if (req.method === 'POST' && pathname === '/api/auth/login') {
    const body = await readBody(req);
    if (!passIsSet()) return sendJSON(res, 400, { ok: false, error: '还没设置过密码' });
    await new Promise((r) => setTimeout(r, 400));   // 稍微拖一下，防暴力试密码
    if (!checkPass(String(body.password || ''))) {
      return sendJSON(res, 401, { ok: false, error: '密码不对' });
    }
    return sendJSON(res, 200, { ok: true, token: issueToken() });
  }

  /* —— 其余所有接口都要先过密码这一关 —— */
  if (passIsSet() && !tokenValid(req)) {
    return sendJSON(res, 401, { ok: false, code: 'AUTH', error: '请先输入管理员密码' });
  }

  if (req.method === 'GET' && pathname === '/api/db') {
    return sendJSON(res, 200, { ok: true, db: readDB() });
  }

  if (req.method !== 'POST') return sendJSON(res, 405, { ok: false, error: '方法不支持' });

  const body = await readBody(req);
  const db = readDB();

  switch (pathname) {
    case '/api/article/save': {
      const a = body.article;
      if (!a || !a.id) throw new Error('文章缺少 id');
      const i = (db.articles || []).findIndex((x) => x.id === a.id);
      if (i >= 0) db.articles[i] = a;
      else db.articles.unshift(a);
      writeDB(db);
      return sendJSON(res, 200, { ok: true, id: a.id });
    }

    case '/api/article/delete': {
      const before = db.articles.length;
      db.articles = db.articles.filter((x) => x.id !== body.id);
      if (db.articles.length === before) throw new Error('没找到这篇文章');
      writeDB(db);
      return sendJSON(res, 200, { ok: true });
    }

    case '/api/site/save': {
      db.site = Object.assign({}, db.site, body.site || {});
      writeDB(db);
      return sendJSON(res, 200, { ok: true });
    }

    case '/api/upload': {
      const url = saveUpload(body);
      return sendJSON(res, 200, { ok: true, url });
    }

    case '/api/rebuild': {
      build(db);
      return sendJSON(res, 200, { ok: true });
    }

    case '/api/backup': {
      // 把最要紧的两样（文章底稿 + 全部图片）打成一个 zip，存进「备份」文件夹。
      // 只保留最近 10 份，不会越积越多。
      const backupDir = path.join(ROOT, '备份');
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
      // 用本地时间命名，看文件名就知道是哪天几点备的
      const d = new Date();
      const p2 = (n) => String(n).padStart(2, '0');
      const stamp = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
      const out = path.join(backupDir, '网站备份-' + stamp + '.zip');
      await new Promise((resolve, reject) => {
        execFile('zip', ['-r', '-q', out, 'data/db.json', 'uploads', '-x', '*.DS_Store'], { cwd: ROOT },
          (e) => (e ? reject(new Error('打包失败：' + e.message)) : resolve()));
      });
      const old = fs.readdirSync(backupDir).filter((f) => /^网站备份-.*\.zip$/.test(f)).sort();
      old.slice(0, Math.max(0, old.length - 10)).forEach((f) => fs.unlinkSync(path.join(backupDir, f)));
      const mb = (fs.statSync(out).size / 1024 / 1024).toFixed(1);
      return sendJSON(res, 200, { ok: true, file: '备份/' + path.basename(out), size: mb + ' MB' });
    }

    case '/api/import': {
      const html = await fetchPage(body.url);
      return sendJSON(res, 200, { ok: true, html, url: body.url });
    }

    case '/api/grab-image': {
      const url = await grabRemoteImage(body.url);
      return sendJSON(res, 200, { ok: true, url });
    }
  }

  return sendJSON(res, 404, { ok: false, error: '未知接口 ' + pathname });
}

/* -------------------------------- 静态文件 -------------------------------- */

// 这些文件包含密码哈希、登录令牌和未发布的草稿，绝不通过网页发出去。
// 按文件名匹配（而不是按路径字符串），这样 /data//db.json、db.json.tmp、
// db.json.broken-xxx 之类的变体写法也一律拦住。
const PRIVATE_NAMES = /^(db\.json|admin-pass\.json|auth-tokens\.json)(\..*)?$/;

function serveStatic(res, pathname) {
  const deny = () => send(res, 403, '禁止访问', 'text/plain; charset=utf-8');
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch (e) {
    // 编码不合法的地址（比如 /%zz）不能让它把整个服务器炸掉
    return send(res, 400, '地址格式不对', 'text/plain; charset=utf-8');
  }
  if (rel === '/' || rel === '') rel = '/index.html';

  const filePath = path.resolve(ROOT, '.' + path.posix.normalize('/' + rel));
  // 安全检查：不允许跳出网站文件夹（注意要带分隔符比，
  // 否则「唐维西的网站_备份」这类同前缀的兄弟文件夹也会被放行）
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) return deny();
  if (PRIVATE_NAMES.test(path.basename(filePath))) return deny();

  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      // 有美化过的 404 页就用它，没有就退回纯文字
      const page = path.join(ROOT, '404.html');
      if (fs.existsSync(page)) {
        return send(res, 404, fs.readFileSync(page), 'text/html; charset=utf-8');
      }
      return send(res, 404, '找不到页面：' + rel, 'text/plain; charset=utf-8');
    }
    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    fs.createReadStream(filePath).pipe(res);
  });
}

/* --------------------------------- 启动 ---------------------------------- */

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    handleAPI(req, res, url.pathname).catch((e) => {
      console.error('接口出错:', e.message);
      sendJSON(res, 400, { ok: false, error: e.message });
    });
    return;
  }
  serveStatic(res, url.pathname);
});

function listen(port, attempt = 0) {
  server.once('error', (e) => {
    if (e.code === 'EADDRINUSE' && attempt < 20) {
      listen(port + 1, attempt + 1);
    } else {
      console.error('启动失败：', e.message);
      process.exit(1);
    }
  });
  // 不把回调传给 listen —— 失败的尝试会把回调残留下来，成功时一起触发，
  // 导致打出好几个端口号都不对的横幅。改成只在真正绑定成功后打一次。
  server.listen(port, '127.0.0.1');
}

server.on('listening', () => {
    const addr = `http://localhost:${server.address().port}`;
    console.log('');
    console.log('  ┌──────────────────────────────────────────┐');
    console.log('  │   唐维西的网站 已启动                     │');
    console.log('  ├──────────────────────────────────────────┤');
    console.log(`  │   网站首页   ${addr.padEnd(28)}│`);
    console.log(`  │   写文章后台 ${(addr + '/admin.html').padEnd(28)}│`);
    console.log('  ├──────────────────────────────────────────┤');
    console.log('  │   关掉这个窗口 = 关掉网站                 │');
    console.log('  └──────────────────────────────────────────┘');
    console.log('');
    if (!process.env.NO_OPEN) {
      execFile('open', [addr], () => {});
    }
});

ensureDirs();
build(readDB());
listen(START_PORT);
