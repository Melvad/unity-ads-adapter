// MRAID for the mobile web: the banner creatives of DSPs (OpenRTB API frameworks 5 = MRAID 2.0, 6 = MRAID 3.0) run
// in the SafeFrame of show.js, which puts this script and window.MRAID_ENV before the creative (its own
// <script src="mraid.js"> is removed). The page side is show.js (src/views/adView.ts). The SafeFrame ext.js cancels
// every message event of the frame, so the frame hands the page a MessageChannel port with its first message
// ("mlvd-mraid:" + json, a string keeps the SafeFrame host parser indifferent) and both talk through the port.
// Supported: the states loading/default/expanded/hidden, the placement types inline (templates 21, 22) and
// interstitial (template 20), the one-part expand() to the whole screen of a phone or a tablet, by a click only,
// close(), unload(), open() (the landing page, by a click only: a creative that calls it on load would send the
// user away at once), the sizes and positions, exposureChange / viewableChange, sizeChange. Not supported:
// resize() and the two-part expand(url) (partial and cross-origin expansions), storePicture, createCalendarEvent.
(function () {
  'use strict';
  if (window.mraid) return;
  var PREFIX = 'mlvd-mraid:';
  var dataNode = document.getElementById('mlvd-mraid-data');
  var data = {};
  try { data = JSON.parse(dataNode.textContent) || {}; } catch (_) {}
  var version = data.version === '2.0' ? '2.0' : '3.0';
  var placementType = data.placementType === 'interstitial' ? 'interstitial' : 'inline';
  var state = 'loading';
  var ready = false;
  var exposure = 0;
  var maxSize = data.maxSize || { width: window.innerWidth, height: window.innerHeight };
  var screenSize = data.screenSize || { width: screen.width, height: screen.height };
  var defaultPosition = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
  var currentPosition = defaultPosition;
  var expandProperties = { width: maxSize.width, height: maxSize.height, useCustomClose: false, isModal: true };
  var resizeProperties = {};
  var orientationProperties = { allowOrientationChange: true, forceOrientation: 'none' };
  var listeners = Object.create(null);
  var lastGesture = 0;

  // a click of the user in this frame: expand() and open() are allowed only right after one
  ['pointerup', 'click', 'touchend', 'keydown'].forEach(function (name) {
    window.addEventListener(name, function (event) { if (event.isTrusted) lastGesture = Date.now(); }, true);
  });
  function activated() {
    if (navigator.userActivation) return navigator.userActivation.isActive;
    return Date.now() - lastGesture < 1000;
  }

  var channel = new MessageChannel();
  function send(message) { channel.port1.postMessage(JSON.stringify(message)); }
  function fire(event) {
    var args = Array.prototype.slice.call(arguments, 1);
    (listeners[event] || []).slice().forEach(function (listener) {
      try { listener.apply(window, args); } catch (_) {}
    });
  }
  function error(message, action) { fire('error', message, action); }
  function setState(next) {
    if (state === next) return;
    state = next;
    fire('stateChange', state);
  }
  function setExposure(percent, rect) {
    var wasViewable = exposure > 0;
    exposure = percent;
    if (version === '3.0') fire('exposureChange', percent, percent > 0 ? rect : null, null);
    if (wasViewable !== percent > 0) fire('viewableChange', percent > 0);
  }

  channel.port1.onmessage = function (event) {
    var message;
    try { message = JSON.parse(event.data); } catch (_) { return; }
    if (message.maxSize) { maxSize = message.maxSize; expandProperties.width = maxSize.width; expandProperties.height = maxSize.height; }
    if (message.screenSize) screenSize = message.screenSize;
    if (message.defaultPosition) defaultPosition = message.defaultPosition;
    if (message.currentPosition) {
      var before = currentPosition;
      currentPosition = message.currentPosition;
      if (ready && (before.width !== currentPosition.width || before.height !== currentPosition.height)) {
        fire('sizeChange', currentPosition.width, currentPosition.height);
      }
    }
    if (message.type === 'state' && ready) setState(message.state);
    if (message.type === 'error') error(message.message, message.action);
    if (message.type === 'exposure') setExposure(message.percent, message.rect);
  };
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(PREFIX + JSON.stringify({ cmd: 'connect' }), '*', [channel.port2]);
  }

  // ready: the document of the creative is loaded; the state goes from loading to default
  function start() {
    if (ready) return;
    ready = true;
    state = 'default';
    fire('stateChange', state);
    fire('ready');
    send({ cmd: 'ready' });
  }
  if (document.readyState === 'complete') setTimeout(start, 0);
  else window.addEventListener('load', function () { setTimeout(start, 0); });

  function copy(value) { var out = {}; for (var key in value) out[key] = value[key]; return out; }
  function safeURL(url) {
    try { var parsed = new URL(url, document.baseURI); return /^(https?|tel|sms|mailto):$/.test(parsed.protocol) ? parsed.href : ''; }
    catch (_) { return ''; }
  }

  window.mraid = {
    getVersion: function () { return version; },
    addEventListener: function (event, listener) {
      if (typeof listener !== 'function') { error('listener is not a function', 'addEventListener'); return; }
      (listeners[event] = listeners[event] || []).push(listener);
    },
    removeEventListener: function (event, listener) {
      if (!listeners[event]) return;
      listeners[event] = listener ? listeners[event].filter(function (item) { return item !== listener; }) : [];
    },
    getState: function () { return state; },
    getPlacementType: function () { return placementType; },
    isViewable: function () { return exposure > 0; },
    // the landing page in a new tab, by a click of the user only: a call on load is a bug of the creative, not a click
    open: function (url) {
      var target = safeURL(url);
      if (!target) { error('invalid URL', 'open'); return; }
      if (!activated()) { error('open needs a click of the user', 'open'); return; }
      window.open(target, '_blank');
    },
    // the one-part expansion to the whole screen, by a click of the user only
    expand: function (url) {
      if (url !== undefined && url !== null && url !== '') { error('two-part expand is not supported', 'expand'); return; }
      if (placementType !== 'inline' || state !== 'default') { error('expand is not available in this state', 'expand'); return; }
      if (!data.expandable) { error('expand is not allowed for this placement or device', 'expand'); return; }
      // attr 3 (expandable automatic): the creative may expand by itself, 4 and 5 need a click of the user
      if (!data.automatic && !activated()) { error('expand needs a click of the user', 'expand'); return; }
      send({ cmd: 'expand', activated: true });
    },
    close: function () {
      if (state === 'hidden' || state === 'loading') return;
      send({ cmd: 'close' });
    },
    unload: function () { send({ cmd: 'unload' }); },
    resize: function () { error('resize is not supported', 'resize'); },
    getExpandProperties: function () { return copy(expandProperties); },
    setExpandProperties: function (properties) {
      if (properties && typeof properties.useCustomClose === 'boolean') expandProperties.useCustomClose = properties.useCustomClose;
    },
    // the close button of show.js stays whatever the creative draws (MRAID 3.0)
    useCustomClose: function (value) { expandProperties.useCustomClose = !!value; },
    getResizeProperties: function () { return copy(resizeProperties); },
    setResizeProperties: function (properties) { resizeProperties = copy(properties || {}); },
    getCurrentPosition: function () { return copy(currentPosition); },
    getDefaultPosition: function () { return copy(defaultPosition); },
    getMaxSize: function () { return copy(maxSize); },
    getScreenSize: function () { return copy(screenSize); },
    supports: function (feature) {
      if (feature === 'sms' || feature === 'tel') return !!data.handheld;
      return feature === 'inlineVideo';
    },
    storePicture: function () { error('storePicture is not supported', 'storePicture'); },
    createCalendarEvent: function () { error('createCalendarEvent is not supported', 'createCalendarEvent'); },
    playVideo: function (url) { window.mraid.open(url); },
    getOrientationProperties: function () { return copy(orientationProperties); },
    setOrientationProperties: function (properties) { orientationProperties = copy(properties || {}); },
    getCurrentAppOrientation: function () {
      return { orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait', locked: false };
    },
    getLocation: function () { return -1; }
  };
})();
