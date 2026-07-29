/* ============================================================
   全局爵士乐播放器（跨页连续）
   -------------------------------------------------------------
   · 首页：嵌入 hero 的 #jazzBar
   · 文章 / 归档 / 关于 / 友链：右下角浮层迷你播放器
   · 后台 admin.html 不加载本脚本
   · sessionStorage 记住曲目 / 进度 / 播放中 / 随机 → 切页几乎无感续播
   · 点击 / 滚动 / 触控 / 键盘 均可解锁有声播放
   · 随机播放（默认开，可切换为顺序）
   ============================================================ */
(function () {
  'use strict';

  // 后台 / 编辑页：不碰音乐
  var path = (location.pathname || '').toLowerCase();
  if (/admin\.html$/.test(path) || document.body.classList.contains('admin')) return;

  var list = (window.MUSIC_LIST || []).slice();
  if (!list.length) return;

  var STATE_KEY = 'jazz-player-state-v1';
  var UNLOCK_KEY = 'jazz-audio-unlocked';
  var lastVol = 0.75;
  var wantSound = true;
  var started = false;
  var scrubbing = false;
  var soundUnlocked = false;
  var gestureArmed = false;
  var saveTimer = null;
  var isHome = !!document.getElementById('jazzBar');

  // 随机播放
  var shuffleOn = true;
  var queue = [];     // 即将播放的随机队列（不含当前曲）
  var history = [];   // 已播过的曲目索引，供「上一首」回退

  try { soundUnlocked = sessionStorage.getItem(UNLOCK_KEY) === '1'; } catch (e) { /* */ }

  // ---- 读取 / 写入跨页状态 ----
  function readState() {
    try {
      var raw = sessionStorage.getItem(STATE_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || typeof s.idx !== 'number') return null;
      return s;
    } catch (e) { return null; }
  }

  function writeState(partial) {
    try {
      var cur = readState() || {};
      var next = Object.assign({}, cur, partial, { t: Date.now() });
      sessionStorage.setItem(STATE_KEY, JSON.stringify(next));
    } catch (e) { /* */ }
  }

  function markUnlocked() {
    soundUnlocked = true;
    try { sessionStorage.setItem(UNLOCK_KEY, '1'); } catch (e) { /* */ }
  }

  // ---- 构建 / 挂载 UI ----
  function playerHTML() {
    return (
      '<div class="jp-art" aria-hidden="true">' +
        '<img class="jp-cover" alt="" width="140" height="140" draggable="false">' +
        '<div class="jp-cover-fallback"></div>' +
        '<div class="jp-art-glow"></div>' +
      '</div>' +
      '<div class="jp-body">' +
        '<div class="jp-meta">' +
          '<span class="jp-title">即将播放</span>' +
          '<span class="jp-artist">经典爵士乐</span>' +
        '</div>' +
        '<div class="jp-scrub" role="slider" aria-label="播放进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0">' +
          '<div class="jp-progress"><div class="jp-filled"></div><div class="jp-knob"></div></div>' +
          '<div class="jp-time-row"><span class="jp-cur">0:00</span><span class="jp-dur">–:–</span></div>' +
        '</div>' +
        '<div class="jp-controls">' +
          '<button class="jp-btn jp-prev" aria-label="上一首" title="上一首">' +
            '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zM9.5 12l8.5 6V6z"/></svg>' +
          '</button>' +
          '<button class="jp-btn jp-play" aria-label="播放/暂停" title="播放爵士乐">' +
            '<svg class="jp-ico-play" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
            '<svg class="jp-ico-pause" viewBox="0 0 24 24" fill="currentColor" style="display:none"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>' +
          '</button>' +
          '<button class="jp-btn jp-next" aria-label="下一首" title="下一首">' +
            '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6zM16 6h2v12h-2z"/></svg>' +
          '</button>' +
          '<button class="jp-btn jp-shuffle" aria-label="随机播放" title="随机 / 顺序" aria-pressed="true">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="M4 4l5 5"/></svg>' +
          '</button>' +
          '<button class="jp-btn jp-vol" aria-label="静音切换" title="静音 / 恢复">' +
            '<svg class="jp-ico-vol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14"/></svg>' +
            '<svg class="jp-ico-mute" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M23 9l-6 6M17 9l6 6"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>'
    );
  }

  var root = document.getElementById('jazzBar');
  if (!root) {
    // 非首页：浮层迷你播放器
    root = document.createElement('div');
    root.id = 'jazzBar';
    root.className = 'jazz-player jazz-player--float';
    root.hidden = true;
    root.innerHTML = playerHTML();
    document.body.appendChild(root);
  } else {
    // 首页：用统一模板重建，保证控件（含随机播放按钮）和浮层一致，
    // 避免 HTML 里静态结构和 JS 模板不同步
    root.innerHTML = playerHTML();
  }

  // ---- DOM ----
  var playBtn    = root.querySelector('.jp-play');
  var prevBtn    = root.querySelector('.jp-prev');
  var nextBtn    = root.querySelector('.jp-next');
  var shuffleBtn = root.querySelector('.jp-shuffle');
  var titleEl    = root.querySelector('.jp-title');
  var artistEl   = root.querySelector('.jp-artist');
  var scrubEl    = root.querySelector('.jp-scrub');
  var progressEl = root.querySelector('.jp-progress');
  var filledEl   = root.querySelector('.jp-filled');
  var knobEl     = root.querySelector('.jp-knob');
  var curEl      = root.querySelector('.jp-cur');
  var durEl      = root.querySelector('.jp-dur');
  var coverEl    = root.querySelector('.jp-cover');
  var volBtn     = root.querySelector('.jp-vol');
  var volIco     = root.querySelector('.jp-ico-vol');
  var muteIco    = root.querySelector('.jp-ico-mute');
  var playIco    = root.querySelector('.jp-ico-play');
  var pauseIco   = root.querySelector('.jp-ico-pause');
  var artEl      = root.querySelector('.jp-art');

  // ---- Audio ----
  var audio = document.createElement('audio');
  audio.setAttribute('playsinline', '');
  audio.setAttribute('webkit-playsinline', '');
  audio.preload = 'auto';
  audio.autoplay = false;
  audio.style.cssText = 'position:fixed;width:0;height:0;opacity:0;pointer-events:none;left:0;top:0;';
  document.body.appendChild(audio);
  audio.volume = lastVol;

  var saved = readState();
  var idx = (saved && saved.idx >= 0 && saved.idx < list.length)
    ? saved.idx
    : Math.floor(Math.random() * list.length);
  var resumeTime = (saved && typeof saved.time === 'number' && saved.time > 0) ? saved.time : 0;
  // 默认认为应该继续播：有存档且 playing，或没有存档（首次）
  var shouldPlay = !saved || saved.playing !== false;
  if (saved && typeof saved.volume === 'number') {
    lastVol = saved.volume;
    audio.volume = lastVol;
  }
  if (saved && typeof saved.shuffle === 'boolean') shuffleOn = saved.shuffle;

  // ---- 跨页续播：待 seek 的进度（在 src 设置后、真正播放前应用）----
  var pendingSeek = null;

  function tryApplySeek() {
    if (pendingSeek == null) return false;
    var dur = audio.duration;
    if (!isFinite(dur) || dur <= 0) return false; // 元数据还没好，等下一拍
    var st = pendingSeek;
    if (st > dur - 0.3) st = 0; // 接近结尾就从头来，避免一进页面又「结束」
    try {
      audio.currentTime = st;
      setProgress(dur ? (st / dur * 100) : 0);
      curEl.textContent = fmt(st);
      pendingSeek = null;
      return true;
    } catch (e) { return false; }
  }

  // ---- 工具 ----
  function fmt(t) {
    if (!isFinite(t) || t < 0) t = 0;
    var m = Math.floor(t / 60);
    var s = Math.floor(t % 60);
    return m + ':' + (s < 10 ? '0' + s : s);
  }

  function syncPlayIcon() {
    // 静音播放中也显示「播放」图标，提示用户点一下出声
    var audible = !audio.paused && !audio.ended && !audio.muted;
    playIco.style.display  = audible ? 'none' : '';
    pauseIco.style.display = audible ? '' : 'none';
  }

  function setProgress(pct) {
    pct = Math.max(0, Math.min(100, pct));
    filledEl.style.width = pct + '%';
    if (knobEl) knobEl.style.left = pct + '%';
    if (scrubEl) scrubEl.setAttribute('aria-valuenow', String(Math.round(pct)));
  }

  function setMutedUI(muted) {
    if (muted) {
      volBtn.classList.add('muted');
      if (volIco) volIco.style.display = 'none';
      if (muteIco) muteIco.style.display = '';
    } else {
      volBtn.classList.remove('muted');
      if (volIco) volIco.style.display = '';
      if (muteIco) muteIco.style.display = 'none';
    }
  }

  function setShuffleUI() {
    if (!shuffleBtn) return;
    shuffleBtn.classList.toggle('is-active', shuffleOn);
    shuffleBtn.setAttribute('aria-pressed', String(shuffleOn));
  }

  // overrideTime：切曲目刚 setSrc 时 currentTime 被重置成 0，
  // 这时落盘要写「意图进度」而非 0，否则会污染跨页状态。
  function persistNow(overrideTime) {
    var useTime = (typeof overrideTime === 'number')
      ? overrideTime
      : (isFinite(audio.currentTime) ? audio.currentTime : 0);
    var usePlaying = (typeof overrideTime === 'number')
      ? shouldPlay
      : (!audio.paused && !audio.ended);
    writeState({
      idx: idx,
      time: useTime,
      playing: usePlaying,
      volume: audio.muted ? lastVol : audio.volume,
      muted: !!audio.muted,
      shuffle: shuffleOn,
      file: list[idx] && list[idx].file
    });
  }

  function schedulePersist() {
    if (saveTimer) return;
    saveTimer = setTimeout(function () {
      saveTimer = null;
      persistNow();
    }, 400);
  }

  // 本地 uploads/music/ 或线上 R2 MUSIC_BASE
  function musicBase() {
    var base = window.MUSIC_BASE || 'uploads/music/';
    if (base.slice(-1) !== '/') base += '/';
    return base;
  }

  function musicUrl(file) {
    if (!file) return '';
    if (/^https?:\/\//i.test(file)) return file;
    return musicBase() + file;
  }

  function coverUrl(cover) {
    if (!cover) return '';
    if (/^https?:\/\//i.test(cover)) return cover;
    return musicBase() + 'covers/' + cover;
  }

  function applyCover(track) {
    var url = coverUrl(track.cover);
    coverEl.classList.remove('is-loaded');
    coverEl.removeAttribute('src');
    artEl.style.setProperty('--cover-tint', track.tint || '#c48a4a');
    if (!url) return;
    var img = new Image();
    img.onload = function () {
      coverEl.src = url;
      coverEl.classList.add('is-loaded');
    };
    img.src = url;
  }

  function load(i, opts) {
    opts = opts || {};
    idx = (i + list.length) % list.length;
    var t = list[idx];
    titleEl.textContent = t.title;
    artistEl.textContent = t.artist;
    applyCover(t);
    audio.src = musicUrl(t.file);
    try { audio.load(); } catch (e) { /* */ }
    setProgress(0);
    curEl.textContent = '0:00';
    durEl.textContent = '–:–';
    // 准备 seek 到指定进度（跨页续播的关键）
    var seekTime = (typeof opts.time === 'number' && opts.time > 0) ? opts.time : 0;
    pendingSeek = seekTime > 0 ? seekTime : null;
    tryApplySeek(); // 命中缓存时能立刻 seek
    if (opts.autoplay || (started && opts.autoplay !== false)) {
      kickPlay();
    }
    // 落盘时写「意图进度」，别用被重置的 currentTime=0 把跨页状态冲掉
    persistNow(seekTime);
  }

  function onPlayingOk(withSound) {
    started = true;
    root.classList.add('is-playing');
    syncPlayIcon();
    if (withSound) {
      markUnlocked();
      audio.muted = false;
      audio.volume = lastVol || 0.75;
      setMutedUI(false);
    }
    persistNow();
  }

  function playWithSound() {
    audio.muted = false;
    audio.volume = lastVol || 0.75;
    wantSound = true;
    return audio.play().then(function () {
      onPlayingOk(true);
      return true;
    });
  }

  function playMuted() {
    audio.muted = true;
    return audio.play().then(function () {
      started = true;
      root.classList.add('is-playing');
      syncPlayIcon();
      setMutedUI(true);
      persistNow();
      return true;
    });
  }

  function kickPlay() {
    // 非手势上下文（页面加载 / 切回前台）：先试有声，被浏览器策略拦就静音播放并等手势。
    // ⚠️ 这里绝不在 promise 链里调 tryUnmute —— audio.play() 对已在播放的音频会立即 resolve，
    //    会误判"开声成功"并 disarm 手势监听，导致后续滚动 / 点击再没反应。
    return playWithSound().catch(function () {
      return playMuted();
    });
  }

  function play() {
    started = true;
    shouldPlay = true;
    wantSound = true;
    audio.muted = false;
    audio.volume = lastVol || 0.75;
    return audio.play().then(function () {
      onPlayingOk(true);
    }).catch(function () {
      // 点播放仍失败：试静音，再等手势
      return playMuted();
    });
  }

  function pause() {
    audio.pause();
    root.classList.remove('is-playing');
    syncPlayIcon();
    persistNow();
  }

  function toggle() {
    if (audio.paused) play();            // 没在播：开始
    else if (audio.muted) unmuteNow();   // 静音播放中：点一下开声
    else pause();                        // 有声播放中：暂停
  }

  // 在播放按钮点击（用户手势）里调用：直接取消静音出声
  function unmuteNow() {
    audio.muted = false;
    if (!audio.volume) audio.volume = lastVol || 0.75;
    wantSound = true;
    onPlayingOk(true);
  }

  // ---- 随机队列 ----
  function refillQueue() {
    var others = [];
    for (var i = 0; i < list.length; i++) if (i !== idx) others.push(i);
    for (var j = others.length - 1; j > 0; j--) {
      var r = Math.floor(Math.random() * (j + 1));
      var tmp = others[j]; others[j] = others[r]; others[r] = tmp;
    }
    queue = others;
  }

  function pickNext() {
    if (!shuffleOn) return (idx + 1) % list.length;
    if (!queue.length) refillQueue();
    var ni = queue.shift();
    if (ni === idx) { // 极少数情况下首项还是自己，换下一个
      ni = queue.length ? queue.shift() : (idx + 1) % list.length;
    }
    return ni;
  }

  function next() {
    history.push(idx);
    if (history.length > 50) history.shift();
    pendingSeek = null;
    shouldPlay = true;
    load(pickNext(), { autoplay: true, time: 0 });
  }
  function prev() {
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      persistNow(0);
      return;
    }
    var pi = history.length ? history.pop() : (idx - 1 + list.length) % list.length;
    pendingSeek = null;
    shouldPlay = true;
    load(pi, { autoplay: true, time: 0 });
  }

  // ---- 手势解锁（点击 / 按键 / 触摸）----
  // 只挂真正算用户激活的事件；滚动（wheel/scroll）在多数浏览器不算媒体手势激活，
  // 且容易在非手势上下文误触发，已移除。点击页面任意处或播放键即可开声。
  var GESTURE_TYPES = [
    'pointerdown', 'mousedown', 'click',
    'keydown', 'touchstart'
  ];

  function onUserGesture(e) {
    // 播放器内部交互（拖进度条、按按钮）不触发兜底开声
    if (e && e.target && root && root.contains(e.target)) return;
    // 已在有声播放：收工
    if (!audio.paused && !audio.muted && audio.volume > 0) {
      disarmGesture();
      return;
    }
    // 能进到这里都是真实用户手势：在手势的同步上下文里直接取消静音，
    // 浏览器才会放行出声（非手势上下文里 unmute 会被自动暂停 / 抑制）。
    audio.muted = false;
    if (!audio.volume) audio.volume = lastVol || 0.75;
    wantSound = true;
    if (audio.paused) {
      // 还没开始播：手势内启动（有声）
      var p = audio.play();
      if (p && p.then) {
        p.then(function () { onPlayingOk(true); }).catch(function () { playMuted(); });
      } else {
        onPlayingOk(true);
      }
    } else {
      // 静音播放中：手势内取消静音即出声
      onPlayingOk(true);
    }
  }

  function armGestureUnlock() {
    if (gestureArmed) return;
    gestureArmed = true;
    GESTURE_TYPES.forEach(function (t) {
      window.addEventListener(t, onUserGesture, { capture: true, passive: true });
      document.addEventListener(t, onUserGesture, { capture: true, passive: true });
    });
  }

  function disarmGesture() {
    if (!gestureArmed) return;
    gestureArmed = false;
    GESTURE_TYPES.forEach(function (t) {
      window.removeEventListener(t, onUserGesture, true);
      document.removeEventListener(t, onUserGesture, true);
    });
  }

  // 始终挂着：即使用户在文章页第一次进来，滚一下就播
  armGestureUnlock();

  // ---- 进度条：监听整个 scrub 区，命中区域大得多 ----
  function progressFromEvent(e) {
    var r = progressEl.getBoundingClientRect();
    if (!r.width) r = scrubEl.getBoundingClientRect();
    var clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width));
  }
  function seekTo(p) {
    var dur = audio.duration;
    if (!isFinite(dur) || dur <= 0) return;
    audio.currentTime = p * dur;
    setProgress(p * 100);
    curEl.textContent = fmt(audio.currentTime);
    persistNow();
  }
  function onScrubStart(e) {
    if (e.button != null && e.button !== 0) return;
    scrubbing = true;
    scrubEl.classList.add('is-dragging');
    seekTo(progressFromEvent(e));
    if (e.pointerId != null && scrubEl.setPointerCapture) {
      try { scrubEl.setPointerCapture(e.pointerId); } catch (err) { /* */ }
    }
    e.preventDefault();
  }
  scrubEl.addEventListener('pointerdown', onScrubStart);
  scrubEl.addEventListener('pointermove', function (e) {
    if (scrubbing) seekTo(progressFromEvent(e));
  });
  function endScrub() {
    if (!scrubbing) return;
    scrubbing = false;
    scrubEl.classList.remove('is-dragging');
  }
  scrubEl.addEventListener('pointerup', endScrub);
  scrubEl.addEventListener('pointercancel', endScrub);
  scrubEl.addEventListener('lostpointercapture', endScrub);
  // 键盘可达：左右键微调
  scrubEl.addEventListener('keydown', function (e) {
    var dur = audio.duration;
    if (!isFinite(dur) || dur <= 0) return;
    var step = dur * 0.05;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      audio.currentTime = Math.min(dur, audio.currentTime + step);
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      audio.currentTime = Math.max(0, audio.currentTime - step);
      e.preventDefault();
    }
  });

  // ---- 控件 ----
  playBtn.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
  nextBtn.addEventListener('click', function (e) { e.stopPropagation(); next(); });
  prevBtn.addEventListener('click', function (e) { e.stopPropagation(); prev(); });
  if (shuffleBtn) shuffleBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    shuffleOn = !shuffleOn;
    setShuffleUI();
    queue = []; // 切换模式后重新生成队列
    persistNow();
  });
  artEl.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
  artEl.style.cursor = 'pointer';

  volBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    if (!audio.muted && audio.volume > 0) {
      lastVol = audio.volume || 0.75;
      audio.muted = true;
      setMutedUI(true);
      wantSound = false;
    } else {
      audio.muted = false;
      audio.volume = lastVol || 0.75;
      setMutedUI(false);
      wantSound = true;
      markUnlocked();
      if (audio.paused) play();
    }
    persistNow();
  });

  // ---- 音频事件 ----
  audio.addEventListener('timeupdate', function () {
    if (scrubbing || !isFinite(audio.duration) || audio.duration <= 0) return;
    setProgress(audio.currentTime / audio.duration * 100);
    curEl.textContent = fmt(audio.currentTime);
    schedulePersist();
  });
  audio.addEventListener('loadedmetadata', function () {
    durEl.textContent = fmt(audio.duration);
    tryApplySeek();
  });
  audio.addEventListener('durationchange', tryApplySeek);
  audio.addEventListener('canplay', function () {
    tryApplySeek();
    errCount = 0;
  });
  audio.addEventListener('ended', next);
  audio.addEventListener('play', function () {
    root.classList.add('is-playing');
    syncPlayIcon();
    persistNow();
  });
  audio.addEventListener('pause', function () {
    root.classList.remove('is-playing');
    syncPlayIcon();
    persistNow();
  });

  var errCount = 0;
  audio.addEventListener('error', function () {
    errCount++;
    if (errCount >= list.length) {
      titleEl.textContent = '暂无可用音乐';
      artistEl.textContent = '请检查音乐文件或 R2 链接';
      return;
    }
    load(idx + 1, { autoplay: shouldPlay || started, time: 0 });
  });

  // 空格键（输入框除外）
  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
    if (e.code === 'Space') {
      e.preventDefault();
      toggle();
    }
  });

  // 切页前立刻落盘（无感续播的关键）
  function flushBeforeLeave() {
    if (pendingSeek != null) persistNow(pendingSeek); // 别用未 seek 的 0 覆盖进度
    else persistNow();
  }
  window.addEventListener('pagehide', flushBeforeLeave);
  window.addEventListener('beforeunload', flushBeforeLeave);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      if (pendingSeek != null) persistNow(pendingSeek); else persistNow();
    }
    if (document.visibilityState === 'visible') {
      // 切回前台没有手势，只能续静音播放；真正开声等下一次用户手势
      if (audio.paused && shouldPlay) kickPlay();
    }
  });

  // 点站内链接时提前存状态，下一页立刻接上
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (!href || href.charAt(0) === '#' || href.indexOf('mailto:') === 0) return;
    persistNow();
  }, true);

  // ---- 初始化 ----
  setShuffleUI();
  load(idx, { autoplay: false, time: resumeTime });
  syncPlayIcon();
  root.hidden = false;
  requestAnimationFrame(function () {
    root.classList.add('is-ready');
  });

  // 跨页续播 / 首次自动播
  function boot() {
    if (!shouldPlay) {
      armGestureUnlock();
      return;
    }
    // 有待 seek 且 duration 还没好 → 等一拍再 boot，避免从 0 开始播
    if (pendingSeek != null && !tryApplySeek()) {
      setTimeout(boot, 120);
      return;
    }
    kickPlay();
    [200, 600, 1200, 2400, 4000].forEach(function (ms) {
      setTimeout(function () {
        if (!audio.paused && !audio.muted) return;
        // 只在确实没播起来时重试 kickPlay（会落回静音播放）；
        // 不要在这里 tryUnmute（非手势，会误判 + disarm）
        if (audio.paused && shouldPlay) {
          if (pendingSeek != null) tryApplySeek();
          kickPlay();
        }
      }, ms);
    });
  }

  if (audio.readyState >= 2) boot();
  else {
    function onCanplayBoot() {
      audio.removeEventListener('canplay', onCanplayBoot);
      boot();
    }
    audio.addEventListener('canplay', onCanplayBoot);
    setTimeout(boot, 800); // 兜底：canplay 偶发不触发
  }
})();
