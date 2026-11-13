/* Melvad Android bootstrap. It owns events and visibility, never tracking pixels. */
(function () {
  'use strict';
  const FRAME_ORIGIN = 'https://frame.melvad.invalid';
  const observers = new Set();
  const videoFormats = ['inread','inslide','infeed','instream','fullscreen','rewarded'];
  let videoModes, pendingVideoCommands = [];
  const BrowserObserver = window.IntersectionObserver;
  let viewport = {visible:false,left:0,top:0,right:0,bottom:0};
  let config, ad, video, loaded = false, impressed = false, terminal = false;
  let videoStarted = false, pausedByHost = false, expanded = false, resizeObserver;
  let reportedHeight;
  const stage = document.getElementById('ad');

  function emit(event, payload = {}) {
    if (!config || !window.MelvadNative) return;
    window.MelvadNative.postMessage(JSON.stringify({
      protocol:1,requestId:config.requestId,event,payload,
    }));
  }
  window.addEventListener('melvad:omid', event => {
    if (!terminal && event.detail && typeof event.detail === 'object') emit('omid',event.detail);
  });
  function end(event, message) {
    if (terminal) return;
    terminal = true;
    emit(event, message ? {message} : {});
    video?.stopAd();
    videoModes?.destroy();
    pendingVideoCommands = [];
    ad?.remove();
    resizeObserver?.disconnect();
  }
  function intersection(a,b) {
    const left = Math.max(a.left,b.left), top = Math.max(a.top,b.top);
    const right = Math.max(left,Math.min(a.right,b.right));
    const bottom = Math.max(top,Math.min(a.bottom,b.bottom));
    return new DOMRect(left,top,right-left,bottom-top);
  }
  function fraction(rect) {
    const clipped = intersection(rect,viewport);
    return viewport.visible && rect.width > 0 && rect.height > 0 ?
      clipped.width * clipped.height / (rect.width * rect.height) : 0;
  }
  // WebView DOM geometry alone cannot see clipping by a native scroll container.
  // Intersect each browser entry with the Android-visible rectangle.
  if (BrowserObserver) {
    window.IntersectionObserver = class extends BrowserObserver {
      constructor(callback, options) {
        let instance;
        super(entries => instance.accept(entries),options);
        instance = this;
        this.callback = callback;
        this.entries = new Map();
      }
      observe(target) { observers.add(this); super.observe(target); }
      unobserve(target) { this.entries.delete(target); super.unobserve(target); }
      disconnect() { observers.delete(this); this.entries.clear(); super.disconnect(); }
      accept(entries) {
        for (const entry of entries) this.entries.set(entry.target,entry);
        this.publish(entries);
      }
      publish(entries = [...this.entries.values()]) {
        if (!entries.length) return;
        this.callback(entries.map(entry => {
          const rect = viewport.visible ? intersection(entry.intersectionRect,viewport) : new DOMRect();
          const area = entry.boundingClientRect.width * entry.boundingClientRect.height;
          const ratio = area > 0 ? Math.min(1,rect.width*rect.height/area) : 0;
          return {
            time:performance.now(),target:entry.target,boundingClientRect:entry.boundingClientRect,
            rootBounds:entry.rootBounds,intersectionRect:rect,intersectionRatio:ratio,
            isIntersecting:entry.isIntersecting && ratio > 0,isVisible:viewport.visible && entry.isVisible !== false,
          };
        }),this);
      }
    };
  }
  // Existing renderers already gate sync/refresh/playback on this signal.
  Object.defineProperty(document,'visibilityState',{get:() => viewport.visible ? 'visible' : 'hidden'});
  Object.defineProperty(document,'hidden',{get:() => !viewport.visible});

  function notifyFrame(frame) {
    if (!config) return;
    const bounds = frame.getBoundingClientRect();
    const clip = intersection(viewport,bounds);
    frame.contentWindow?.postMessage(JSON.stringify({
      type:'melvad:viewport',
      visible:viewport.visible,
      rect:{left:clip.left-bounds.left,top:clip.top-bounds.top,
        right:clip.right-bounds.left,bottom:clip.bottom-bounds.top},
      app:config.app,
      consent:{gdprApplies:config.consent.gdprApplies,tcString:config.consent.tcString},
    }),FRAME_ORIGIN);
  }
  function updateVideo() {
    if (!video || !loaded || terminal) return;
    const bounds = stage.getBoundingClientRect();
    const visible = fraction(bounds) >= 0.5;
    if (!videoStarted && visible) { videoStarted = true; video.startAd(); return; }
    if (!videoStarted) return;
    if (!visible && !pausedByHost && video.state === 'PLAYING') {
      pausedByHost = true; video.pauseAd();
    } else if (visible && pausedByHost && video.state === 'PAUSED') {
      pausedByHost = false; video.resumeAd();
    }
  }
  function reportSize() {
    if (terminal || expanded) return;
    const dock = config?.format === 'adhesion' && document.querySelector('.mlvd-adhesion');
    // The dock's close button occupies 50 CSS px above the creative.
    const height = videoModes ? videoModes.layoutHeight() : Math.ceil(dock ? dock.getBoundingClientRect().height + 50 : stage.getBoundingClientRect().height);
    if (height !== reportedHeight && height >= (['inread','inslide'].includes(config?.format) ? 0 : 1) && height <= 4096) {
      reportedHeight = height;
      emit('size',{height});
    }
  }
  function setViewport(value) {
    if (!value || typeof value.visible !== 'boolean' ||
        !['left','top','right','bottom'].every(key => Number.isFinite(value[key]))) return;
    const windowChanged = viewport.windowWidth !== value.windowWidth || viewport.windowHeight !== value.windowHeight;
    const visibilityChanged = viewport.visible !== value.visible;
    viewport = value;
    if (config && windowChanged) window.dispatchEvent(new Event('resize'));
    for (const observer of observers) observer.publish();
    if (visibilityChanged) document.dispatchEvent(new Event('visibilitychange'));
    for (const frame of stage.querySelectorAll('iframe')) notifyFrame(frame);
    updateVideo();
    videoModes?.viewportChanged();
    window.dispatchEvent(new Event('melvad:viewport'));
  }
  window.addEventListener('message',event => {
    if (terminal || event.origin !== FRAME_ORIGIN || typeof event.data !== 'string' || event.data.length > 65536) return;
    let data; try { data = JSON.parse(event.data); } catch { return; }
    if (!['melvad:native-ready','melvad:video','melvad:video-error','melvad:omid'].includes(data?.type)) return;
    const frame = [...stage.querySelectorAll('iframe')].find(frame => frame.contentWindow === event.source);
    if (!frame) return;
    if (data.type === 'melvad:omid') { emit('omid',data.payload); return; }
    if (data.type === 'melvad:video-error') end('error',/^[A-Z0-9_]+$/.test(data.code) ? data.code : 'VIDEO_ERROR');
    else if (data.type === 'melvad:native-ready') {
      // SafeFrame starts at 0x0 and opens asynchronously. Its final size can equal
      // the reserved stage size, so neither the stage nor Android viewport changes.
      resizeObserver?.observe(frame);
      notifyFrame(frame);
    }
    else if (loaded && typeof data.name === 'string' && Number.isFinite(data.volume)) {
      emit('video',{name:data.name,volume:data.volume});
    }
  });

  function consentApi(snapshot) {
    const listeners = new Map();
    let nextId = 0;
    window.__tcfapi = (command,version,callback,parameter) => {
      if (command === 'removeEventListener') {
        listeners.delete(parameter); callback(true,true); return;
      }
      if (command === 'ping') { callback({cmpLoaded:true,cmpStatus:'loaded',gdprApplies:snapshot.gdprApplies},true); return; }
      if (command !== 'addEventListener' && command !== 'getTCData') { callback(null,false); return; }
      const id = ++nextId;
      if (command === 'addEventListener') listeners.set(id,callback);
      callback({listenerId:id,gdprApplies:snapshot.gdprApplies,tcString:snapshot.tcString,
        cmpStatus:'loaded',eventStatus:'tcloaded'},true);
    };
  }
  function script(path) {
    return new Promise((resolve,reject) => {
      const element = document.createElement('script');
      element.src = '/assets/renderer/'+path;
      element.onload = resolve;
      element.onerror = () => reject(new Error('Pinned renderer asset could not load'));
      document.head.appendChild(element);
    });
  }
  async function display() {
    const response = config.display;
    if (!response || typeof response !== 'object') { end('error', 'Missing prepared creative'); return; }
    await script('show.min.js');
    if (terminal) return;
    ad = window.MelvadShowSDK.createSdkAd({slot:stage,response,format:config.format,onEvent(type,payload) {
      if (terminal) return;
      if (type === 'loaded' && !loaded) {
        loaded = true; emit('loaded',payload); reportSize();
        const dock = document.querySelector('.mlvd-adhesion');
        if (dock) resizeObserver.observe(dock);
      } else if (type === 'impression' && loaded && !impressed) {
        impressed = true; emit('impression');
      } else if (type === 'expanded' && !expanded && ['adhesion','expandable'].includes(config.format)) {
        expanded = true; emit('expanded');
      } else if (type === 'collapsed' && expanded) {
        expanded = false; emit('collapsed'); reportSize();
      } else if (type === 'click' && loaded) emit('click');
      else if (type === 'error' || type === 'noFill' || type === 'closed') end(type === 'closed' && !loaded ? 'noFill' : type,payload?.message);
    }});
  }
  async function playback() {
    stage.style.aspectRatio = '16 / 9';
    await script('video/main.js');
    if (terminal) return;
    video = window.getVPAIDAd();
    video.mode = 'outstream';
    const on = (name,callback) => video.subscribe((...args) => {
      if (!terminal) callback(...args);
    },name);
    on('AdLoaded',() => {
      video.sdkOmid?.activate();
      loaded = true; emit('loaded'); updateVideo();
    });
    on('AdImpression',() => { if (loaded && !impressed) { impressed = true; emit('impression'); } });
    on('AdClickThru',(url,id,playerHandles) => {
      emit('click');
      if (playerHandles === true && typeof url === 'string' && /^https?:\/\//i.test(url)) window.open(url,'_blank','noopener');
    });
    on('AdError',message => {
      const code = String(message).match(/^[A-Z0-9_]+/)?.[0] || 'VIDEO_ERROR';
      end(code === 'VAST_NO_AD' && !loaded ? 'noFill' : 'error',code);
    });
    on('AdStopped',() => end('closed'));
    on('AdSkipped',() => end('closed'));
    for (const name of ['AdStarted','AdVideoStart','AdVideoFirstQuartile','AdVideoMidpoint',
      'AdVideoThirdQuartile','AdVideoComplete','AdPaused','AdPlaying','AdVolumeChange']) {
      on(name,() => {
        emit('video',{name,volume:video.getAdVolume()});
        if (name==='AdStarted' || name==='AdPaused' || name==='AdPlaying') updateVideo();
      });
    }
    const [inventoryId,placementId,clientId] = config.key.split('#');
    const url = new URL('/assets/demand/video/'+encodeURIComponent(clientId),location.href);
    url.searchParams.set('inventory_id',inventoryId);
    url.searchParams.set('placement_id',placementId);
    const size = stage.getBoundingClientRect();
    video.setAdVolume(0);
    video.initAd(Math.max(1,Math.round(size.width)),Math.max(1,Math.round(size.height)),'normal',1000,
      {AdParameters:JSON.stringify({
        vastUrl:url.href,userSyncUrl:'',withCredentials:false,
        earlyAdLoaded:false,skipButton:false,
      })},{slot:stage});
    reportSize();
  }
  async function startVideoModes() {
    await script('video/main.js');
    if (terminal) return;
    videoModes = window.MelvadVideoModes.create(config,stage,(event,payload={})=>{
      if (terminal) return;
      if (['closed','noFill','error'].includes(event)) { end(event,payload.message); return; }
      if (event==='creative') { loaded=false; impressed=false; }
      if (event==='loaded') loaded=true;
      if (event==='impression') impressed=true;
      emit(event,payload);
    },reportSize);
    emit('videoReady');
    for (const command of pendingVideoCommands.splice(0)) videoModes.command(command);
    reportSize();
  }
  function videoCommand(command) {
    if (terminal || !videoFormats.includes(config?.format) || !command || typeof command.action!=='string') return;
    if (videoModes) videoModes.command(command);
    else {
      if (command.action==='content') pendingVideoCommands=pendingVideoCommands.filter(value=>value.action!=='content');
      if (pendingVideoCommands.length<32) pendingVideoCommands.push(command);
    }
  }
  async function start(value) {
    if (config) return;
    if (!value || value.protocol !== 1 || !value.requestId || !value.app?.bundle ||
        typeof value.consent?.gdprApplies !== 'boolean' ||
        !['banner','native','video','interstitial','adhesion','expandable',...videoFormats].includes(value.format)) return;
    config = value;
    window.mlvdSdkConfig = config;
    window.mlvdSdkVisibility = fraction;
    window.mlvdSdkWindowSize = () => ({
      width:Math.round(Number.isFinite(viewport.windowWidth) && viewport.windowWidth > 0 ? viewport.windowWidth : innerWidth),
      height:Math.round(Number.isFinite(viewport.windowHeight) && viewport.windowHeight > 0 ? viewport.windowHeight : innerHeight),
    });
    window.mlvdApp = config.app;
    consentApi(config.consent);
    if (['interstitial','fullscreen','rewarded'].includes(config.format)) stage.style.height = '100dvh';
    resizeObserver = new ResizeObserver(() => {
      if (videoModes) videoModes.viewportChanged();
      else reportSize();
      for (const frame of stage.querySelectorAll('iframe')) notifyFrame(frame);
      window.dispatchEvent(new Event('melvad:viewport'));
      if (video && !terminal) {
        const size = stage.getBoundingClientRect();
        video.resizeAd(Math.max(1,Math.round(size.width)),Math.max(1,Math.round(size.height)),'normal');
        updateVideo();
      }
    });
    resizeObserver.observe(stage);
    window.addEventListener('resize',reportSize);
    try { await (videoFormats.includes(config.format) ? startVideoModes() : config.format==='video' ? playback() : display()); }
    catch { end('error','Renderer initialization failed'); }
  }
  function collapse() {
    if (terminal || !expanded || !ad) return;
    ad.dispatchEvent(new CustomEvent('mlvd:sdk-collapse'));
  }
  window.MelvadRuntime = Object.freeze({start,viewport:setViewport,collapse,video:videoCommand});
})();
