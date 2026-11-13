// Android host visibility and consent; there is deliberately no native bridge in this origin.
(function () {
  var host = 'https://sdk.melvad.invalid';
  var consent = {gdprApplies: true, tcString: ''};
  var listeners = new Map(), next = 0;
  window.__melvadHostVisible = false;
  window.__tcfapi = function (command, version, callback, parameter) {
    if (command === 'removeEventListener') { listeners.delete(parameter); callback(true, true); return; }
    if (command !== 'addEventListener' && command !== 'getTCData') { callback(null, false); return; }
    var id = ++next;
    if (command === 'addEventListener') listeners.set(id, callback);
    callback(Object.assign({listenerId:id,cmpStatus:'loaded',eventStatus:'tcloaded'}, consent), true);
  };
  document.addEventListener('melvad:host', function () {
    var data=window.__melvadHostPacket;
    if (data?.type !== 'melvad:viewport') return;
    window.__melvadHostVisible = data.visible === true;
    window.__melvadHostRect = data.rect;
    window.mlvdApp = data.app;
    consent = data.consent || consent;
    listeners.forEach(function (callback,id) { callback(Object.assign({listenerId:id,cmpStatus:'loaded',eventStatus:'useractioncomplete'},consent),true); });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  parent.postMessage(JSON.stringify({type:'melvad:native-ready'}),host);
})();
(function () {
  'use strict';
  var dataNode = document.getElementById('mlvd-native-data');
  if (!dataNode) return;
  var data;
  try { data = JSON.parse(dataNode.textContent); } catch (_) { return; }
  var fired = Object.create(null);
  function validURL(value) {
    try { var url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : ''; }
    catch (_) { return ''; }
  }
  function fire(kind, urls) {
    if (fired[kind]) return;
    fired[kind] = true;
    (urls || []).forEach(function (raw) {
      var url = validURL(raw);
      if (url) { var pixel = new Image(); pixel.src = url; }
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll('.supplier-native__link'), function (link) {
    link.addEventListener('click', function () { fire('native-click', data.clickTracks); });
  });
  // The block (.native-ad-slot) is sized by --mlvd-block-width/--mlvd-block-height of the base styles
  // and the placement theme. show.js (the parent, any origin) gets the rendered size and the raw
  // variables as a string message and resizes the SafeFrame; a string keeps the SafeFrame host's own
  // message parser indifferent. The SafeFrame host shows the iframe only after it loaded, so the
  // size is polled until it is non-zero (a ResizeObserver alone stays silent in an off-screen
  // cross-origin frame, whose rendering the browser throttles); later changes (the theme
  // stylesheet, fonts, images) are reported as they come.
  var slot = document.querySelector('.native-ad-slot');
  // The device of the page: show.js puts it in the markup; when the page crosses 768 px (or turns) the SafeFrame
  // host sends a geom-update with the size of its window and the theme switches to the mobile or desktop sizes and
  // layout. (The SafeFrame ext.js swallows every other message, so its geometry is the channel.)
  function deviceOf(width) {
    var phone = !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches &&
      Math.min(screen.width, screen.height) <= 768;
    return (width > 0 && width <= 768) || phone ? 'mobile' : 'desktop';
  }
  function geometry() {
    var sf = window.$sf && window.$sf.ext;
    var geom = sf && typeof sf.geom === 'function' ? sf.geom() : null;
    var width = geom && geom.win ? Number(geom.win.w) : 0;
    if (slot && width > 0) slot.setAttribute('data-device', deviceOf(width));
  }
  if (window.$sf && window.$sf.ext && typeof window.$sf.ext.register === 'function') {
    try {
      window.$sf.ext.register(0, 0, function (status) { if (status === 'geom-update') geometry(); });
    } catch (_) { /* the host is not a SafeFrame one */ }
  }
  // The AdChoices button on the line of the title: its centre on the centre line of the title (any size and number
  // of lines), its right edge at the right edge of the title cell (alignAdChoices of nativeCard.ts, the same code).
  function alignAdChoices() {
    var article = document.querySelector('.native-ad');
    var head = document.querySelector('.native-ad__head');
    var title = document.querySelector('.native-ad__title');
    var choices = document.querySelector('.native-ad__adchoices');
    var toggle = document.querySelector('.native-ad__adchoices-toggle');
    if (!article || !head || !title || !choices || !toggle || !article.offsetWidth) return;
    var a = article.getBoundingClientRect();
    var k = a.width / article.offsetWidth || 1;
    var t = title.getBoundingClientRect();
    var h = head.getBoundingClientRect();
    var right = (a.right - h.right) / k - 2;
    choices.style.top = Math.round(((t.top + t.height / 2 - a.top) / k - toggle.offsetHeight / 2) * 10) / 10 + 'px';
    choices.style.right = Math.round(right * 10) / 10 + 'px';
    choices.style.width = Math.max(toggle.offsetWidth, Math.min(246, article.offsetWidth - right - 12)) + 'px';
    choices.style.maxWidth = 'none';
  }
  alignAdChoices();
  window.addEventListener('load', alignAdChoices);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(alignAdChoices);
  if (typeof ResizeObserver === 'function') {
    var titleNode = document.querySelector('.native-ad__title');
    var observer = new ResizeObserver(alignAdChoices);
    if (slot) observer.observe(slot);
    if (titleNode) observer.observe(titleNode);
  }
  if (slot && window.parent && window.parent !== window) {
    var lastSize = '';
    var report = function () {
      alignAdChoices();
      var style = getComputedStyle(slot);
      var rect = slot.getBoundingClientRect();
      var size = JSON.stringify({
        w: Math.ceil(rect.width), h: Math.ceil(rect.height),
        width: style.getPropertyValue('--mlvd-block-width').trim(),
        height: style.getPropertyValue('--mlvd-block-height').trim()
      });
      if (size !== lastSize) {
        lastSize = size;
        window.parent.postMessage('mlvd-native-size:' + size, '*');
      }
      return rect.width > 0 && rect.height > 0;
    };
    if (!report()) {
      var tries = 0;
      var poll = setInterval(function () { if (report() || ++tries >= 200) clearInterval(poll); }, 50);
    }
    var sheet = document.querySelector('link[rel="stylesheet"]');
    if (sheet) { sheet.addEventListener('load', report); sheet.addEventListener('error', report); }
    window.addEventListener('load', report);
    if (typeof ResizeObserver === 'function') { new ResizeObserver(report).observe(slot); }
  }
  if (!data.xml || !validURL(data.player || '')) return;
  // Template 11: the VAST of the native video is played by the Melvad player (vpaid.js, vpaid-wrapper.min.js next
  // to show.js on the CDN) inside the media box: muted, started when half of the card is in view, paused out of
  // view, no skip button; the player shows its own ad label, progress, volume and the advertiser info (ORD).
  var box = document.querySelector('.supplier-native__video');
  if (!box) { state('close'); return; }
  var media = box.parentNode;
  var cardLabel = media && media.querySelector('.native-ad__label');
  var playerSlot = document.createElement('div');
  playerSlot.className = 'native-ad__player';
  box.appendChild(playerSlot);

  var ad = null, loaded = false, started = false, finished = false, pausedByCard = false, inView = false;
  // the in-page card: show.js keeps it closed (0 px) until the player is ready and the card is in view, the player
  // starts when the opened card is half in view; after the ad (or a failure) show.js closes and removes the card
  function state(name) {
    if (window.parent && window.parent !== window) window.parent.postMessage('mlvd-native-state:' + name, '*');
  }
  function size() {
    return { w: Math.max(1, Math.round(box.clientWidth)), h: Math.max(1, Math.round(box.clientHeight)) };
  }
  function visible() { var r=box.getBoundingClientRect(), c=window.__melvadHostRect; var area=c ? Math.max(0,Math.min(r.right,c.right)-Math.max(r.left,c.left))*Math.max(0,Math.min(r.bottom,c.bottom)-Math.max(r.top,c.top)) : 0; return window.__melvadHostVisible && inView && r.width*r.height>0 && area/(r.width*r.height)>=0.5 && document.visibilityState !== 'hidden'; }
  function update() {
    if (!ad || finished) return;
    if (loaded && !started && visible()) { started = true; ad.startAd(); return; }
    if (!started) return;
    if (!visible() && !pausedByCard && ad.state === 'PLAYING') { pausedByCard = true; ad.pauseAd(); }
    else if (visible() && pausedByCard && ad.state === 'PAUSED') { pausedByCard = false; ad.resumeAd(); }
  }
  // the ad ended or failed: show.js closes the card
  function finish() {
    if (finished) return;
    finished = true;
    state('close');
  }

  // inside the SafeFrame the observer measures the card against the page viewport
  if (typeof IntersectionObserver === 'function') {
    new IntersectionObserver(function (entries) {
      inView = entries[entries.length - 1].intersectionRatio >= 0.5;
      update();
    }, { threshold: [0, 0.5, 1] }).observe(box);
  } else {
    inView = true;
  }
  document.addEventListener('visibilitychange', update);

  var script = document.createElement('script');
  script.src = data.player;
  script.async = true;
  script.onerror = finish;
  script.onload = function () {
    if (typeof window.getVPAIDAd !== 'function') { finish(); return; }
    ad = window.getVPAIDAd();
    ad.mode = 'outstream';
    // the VAST came with the ad: the player resolves it from this text, the URL below is only its key
    ad.inlineVast = data.xml;
    function on(event, handler) { ad.subscribe(handler, event); }
    ['AdStarted','AdVideoStart','AdVideoFirstQuartile','AdVideoMidpoint','AdVideoThirdQuartile','AdVideoComplete','AdPaused','AdPlaying','AdVolumeChange'].forEach(function (name) {
      on(name, function () { parent.postMessage(JSON.stringify({type:'melvad:video',name:name,volume:ad.getAdVolume()}),'https://sdk.melvad.invalid'); });
    });
    on('AdLoaded', function () { ad.sdkOmid.activate(); loaded = true; state('ready'); update(); });
    on('AdStarted', function () { if (cardLabel) cardLabel.style.display = 'none'; });
    on('AdStarted', update);
    on('AdPaused', update);
    on('AdPlaying', update);
    on('AdStopped', finish);
    on('AdSkipped', finish);
    on('AdError', function (message) {
      var code=String(message).match(/^[A-Z0-9_]+/);
      parent.postMessage(JSON.stringify({type:'melvad:video-error',code:code?code[0]:'VIDEO_ERROR'}),'https://sdk.melvad.invalid');
      finish();
    });
    on('AdClickThru', function (url, id, playerHandles) {
      fire('native-click', data.clickTracks);
      var target = validURL(url || '');
      if (playerHandles && target) window.open(target, '_blank', 'noopener');
    });
    var current = size();
    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(function () {
        var next = size();
        if (next.w === current.w && next.h === current.h) return;
        current = next;
        if (!finished) ad.resizeAd(next.w, next.h, 'normal');
      }).observe(box);
    }
    ad.initAd(current.w, current.h, 'normal', 1000,
      { AdParameters: JSON.stringify({ vastUrl: new URL('native-video.xml', data.player).href, skipButton: false, closeButton: false, earlyAdLoaded: false }) },
      { slot: playerSlot });
  };
  document.head.appendChild(script);
})();
