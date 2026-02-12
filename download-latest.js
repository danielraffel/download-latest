/**
 * download-latest.js v1.0.0
 * Auto-detect OS/arch and download the right GitHub release asset.
 * https://github.com/danielraffel/download-latest
 * MIT License
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) define(factory);
  else if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DownloadLatest = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // --- Platform detection ---

  function detectPlatform() {
    var os = null, arch = null;

    // Try navigator.userAgentData (Chromium)
    var uaData = typeof navigator !== 'undefined' && navigator.userAgentData;
    if (uaData && uaData.platform) {
      var p = uaData.platform.toLowerCase();
      if (p === 'macos' || p === 'mac os x') os = 'macos';
      else if (p === 'windows') os = 'windows';
      else if (p === 'linux' || p === 'chromeos') os = 'linux';
      else if (p === 'android') os = 'android';

      if (uaData.architecture) {
        var a = uaData.architecture.toLowerCase();
        arch = (a === 'arm' || a === 'arm64') ? 'arm64' : 'x64';
      }
    }

    // Fallback: UA string
    if (typeof navigator !== 'undefined') {
      var ua = (navigator.userAgent || '').toLowerCase();
      var plat = (navigator.platform || '').toLowerCase();

      if (!os) {
        // Check iOS/Android before generic matches
        if (/iphone|ipad|ipod/.test(ua)) os = 'ios';
        else if (ua.indexOf('android') !== -1) os = 'android';
        else if (ua.indexOf('mac') !== -1) os = 'macos';
        else if (ua.indexOf('win') !== -1) os = 'windows';
        else if (ua.indexOf('linux') !== -1 || ua.indexOf('cros') !== -1) os = 'linux';
      }

      if (!arch) {
        if (ua.indexOf('arm') !== -1 || ua.indexOf('aarch64') !== -1) arch = 'arm64';
        else if (plat.indexOf('arm') !== -1) arch = 'arm64';
        else if (os === 'macos') arch = 'arm64'; // Apple Silicon is the majority now
        else if (os === 'ios') arch = 'arm64';     // All iOS devices are ARM
        else if (os === 'android') arch = 'arm64'; // Most Android devices are ARM
        else arch = 'x64';
      }
    }

    return { os: os, arch: arch };
  }

  // --- Default asset matching rules ---
  // Each key maps to an ordered array of regexes (first match wins).

  var DEFAULT_MATCH = {
    'macos-arm64':   [/[-_.]aarch64[^/]*\.dmg$/i, /[-_.]arm64[^/]*\.dmg$/i, /\.dmg$/i],
    'macos-x64':     [/[-_.]x86[_-]64[^/]*\.dmg$/i, /[-_.]x64[^/]*\.dmg$/i, /[-_.]intel[^/]*\.dmg$/i, /\.dmg$/i],
    'windows-x64':   [/[-_.]x86[_-]64[^/]*\.exe$/i, /[-_.]x64[^/]*\.exe$/i, /\.exe$/i, /\.msi$/i],
    'windows-arm64': [/[-_.]arm64[^/]*\.exe$/i, /[-_.]x86[_-]64[^/]*\.exe$/i, /\.exe$/i],
    'linux-x64':     [/[-_.]x86[_-]64[^/]*\.AppImage$/i, /[-_.]amd64[^/]*\.deb$/i, /[-_.]x86[_-]64[^/]*\.deb$/i, /[-_.]amd64[^/]*\.AppImage$/i],
    'linux-arm64':   [/[-_.]aarch64[^/]*\.AppImage$/i, /[-_.]arm64[^/]*\.deb$/i, /[-_.]aarch64[^/]*\.deb$/i, /[-_.]aarch64[^/]*\.rpm$/i],
    'ios-arm64':     [/\.ipa$/i],
    'android-arm64': [/[-_.]arm64[^/]*\.apk$/i, /\.apk$/i, /[-_.]arm64[^/]*\.aab$/i]
  };

  // Files to exclude from asset lists
  var EXCLUDE_RE = /\.(sha256|sha512|sig|asc|blockmap|zsync)$/i;

  // --- Asset matching ---

  function filterAssets(rawAssets) {
    var assets = [];
    for (var i = 0; i < rawAssets.length; i++) {
      var a = rawAssets[i];
      if (a.name && a.browser_download_url && !EXCLUDE_RE.test(a.name)) {
        assets.push({ name: a.name, url: a.browser_download_url, size: a.size || 0 });
      }
    }
    return assets;
  }

  function matchAsset(assets, os, arch, customMatch) {
    var key = os + '-' + arch;
    var patterns;

    if (customMatch && customMatch[key]) {
      patterns = Array.isArray(customMatch[key]) ? customMatch[key] : [customMatch[key]];
    } else {
      patterns = DEFAULT_MATCH[key] || [];
    }

    for (var p = 0; p < patterns.length; p++) {
      for (var i = 0; i < assets.length; i++) {
        if (patterns[p].test(assets[i].name)) return assets[i];
      }
    }
    return null;
  }

  // --- GitHub API ---

  function fetchRelease(repo, version) {
    var cacheKey = 'dl-latest:' + repo + ':' + (version || 'latest');

    // Check sessionStorage cache
    try {
      var cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        var parsed = JSON.parse(cached);
        if (Date.now() - parsed.ts < 300000) return Promise.resolve(parsed.data);
      }
    } catch (e) { /* ignore */ }

    var url = version
      ? 'https://api.github.com/repos/' + repo + '/releases/tags/' + version
      : 'https://api.github.com/repos/' + repo + '/releases/latest';

    return fetch(url, {
      headers: { 'Accept': 'application/vnd.github+json' }
    }).then(function (res) {
      if (!res.ok) throw new Error('GitHub API ' + res.status);
      return res.json();
    }).then(function (json) {
      var data = {
        version: json.tag_name,
        releasesUrl: json.html_url,
        assets: filterAssets(json.assets || [])
      };
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({ data: data, ts: Date.now() }));
      } catch (e) { /* ignore */ }
      return data;
    });
  }

  // --- DownloadLatest class ---

  function DownloadLatest(config) {
    if (typeof config === 'string') config = { repo: config };
    this.repo = config.repo;
    this.version = config.version || null;
    this.match = config.match || null;
    this.pattern = config.pattern || null;       // regex or string: match a specific file regardless of platform
    this.text = config.text || (this.pattern ? 'Download' : 'Download for {os}');
    this.noMatchText = config.noMatchText || 'View all downloads';
    this.noMatchUrl = config.noMatchUrl || null; // null = use releases page
    this.contextMenu = !!config.contextMenu;     // opt-in: right-click opens releases page
    this._releasesUrl = 'https://github.com/' + this.repo + '/releases' + (this.version ? '/tag/' + this.version : '/latest');
    this._promise = null;
  }

  DownloadLatest.prototype.get = function () {
    if (this._promise) return this._promise;
    var self = this;
    var platform = detectPlatform();

    this._promise = fetchRelease(this.repo, this.version).then(function (release) {
      var asset = null;

      if (self.pattern) {
        // Pattern mode: match a specific file regardless of platform
        var re = (self.pattern instanceof RegExp) ? self.pattern : new RegExp(self.pattern, 'i');
        for (var i = 0; i < release.assets.length; i++) {
          if (re.test(release.assets[i].name)) { asset = release.assets[i]; break; }
        }
      } else if (platform.os && platform.arch) {
        asset = matchAsset(release.assets, platform.os, platform.arch, self.match);
      }

      return {
        url: asset ? asset.url : release.releasesUrl,
        asset: asset ? asset.name : null,
        os: platform.os,
        arch: platform.arch,
        version: release.version,
        releasesUrl: release.releasesUrl,
        allAssets: release.assets,
        matched: !!asset
      };
    }).catch(function () {
      return {
        url: self._releasesUrl,
        asset: null,
        os: platform.os,
        arch: platform.arch,
        version: null,
        releasesUrl: self._releasesUrl,
        allAssets: [],
        matched: false
      };
    });

    return this._promise;
  };

  DownloadLatest.prototype.attach = function (selectorOrEl) {
    var el = typeof selectorOrEl === 'string'
      ? document.querySelector(selectorOrEl)
      : selectorOrEl;
    if (!el) return;

    var self = this;
    this.get().then(function (result) {
      var targetUrl = result.matched
        ? result.url
        : (self.noMatchUrl || result.releasesUrl);

      if (el.tagName === 'A') {
        el.href = targetUrl;
      } else {
        el.style.cursor = 'pointer';
        el.onclick = function () { window.location.href = targetUrl; };
      }

      var osLabels = { macos: 'macOS', windows: 'Windows', linux: 'Linux', ios: 'iOS', android: 'Android' };
      var label = osLabels[result.os] || 'your platform';

      if (result.matched) {
        el.textContent = self.text
          .replace('{os}', label)
          .replace('{arch}', result.arch || '')
          .replace('{version}', result.version || '');
        el.title = result.asset || '';
      } else {
        el.textContent = self.noMatchText
          .replace('{os}', label)
          .replace('{arch}', result.arch || '')
          .replace('{version}', result.version || '');
        el.title = 'No download available for your platform';
      }

      el.setAttribute('data-dl-os', result.os || '');
      el.setAttribute('data-dl-arch', result.arch || '');
      el.setAttribute('data-dl-matched', result.matched ? 'true' : 'false');

      // Opt-in: right-click / long-press opens releases page
      if (self.contextMenu) {
        el.addEventListener('contextmenu', function (e) {
          if (result.releasesUrl) {
            e.preventDefault();
            window.open(result.releasesUrl, '_blank');
          }
        });
      }
    });
  };

  DownloadLatest.prototype.attachFallback = function (selectorOrEl, opts) {
    var el = typeof selectorOrEl === 'string'
      ? document.querySelector(selectorOrEl)
      : selectorOrEl;
    if (!el) return;

    opts = opts || {};
    var excludePlatforms = opts.exclude || [];

    this.get().then(function (result) {
      el.innerHTML = '';
      var assets = result.allAssets;

      // Filter by excluded platforms if specified
      if (excludePlatforms.length > 0) {
        var excludeOther = excludePlatforms.indexOf('other') !== -1;
        assets = assets.filter(function (asset) {
          var platforms = classifyAsset(asset);
          // Unclassified assets: keep unless 'other' is in the exclude list
          if (platforms.length === 0) return !excludeOther;
          for (var i = 0; i < platforms.length; i++) {
            if (excludePlatforms.indexOf(platforms[i]) === -1) return true;
          }
          return false;
        });
      }

      if (!assets.length) {
        var a = document.createElement('a');
        a.href = result.releasesUrl;
        a.textContent = 'View releases on GitHub';
        a.target = '_blank';
        el.appendChild(a);
        return;
      }
      for (var i = 0; i < assets.length; i++) {
        var link = document.createElement('a');
        link.href = assets[i].url;
        link.textContent = assets[i].name;
        if (assets[i].size) {
          var sizeMB = (assets[i].size / 1048576).toFixed(1);
          link.textContent += ' (' + sizeMB + ' MB)';
        }
        link.style.display = 'block';
        link.style.margin = '4px 0';
        el.appendChild(link);
      }
    });
  };

  // --- Platform selector ---

  var PLATFORM_LABELS = {
    'macos-arm64': 'macOS (Apple Silicon)',
    'macos-x64': 'macOS (Intel)',
    'windows-x64': 'Windows (64-bit)',
    'windows-arm64': 'Windows (ARM)',
    'linux-x64': 'Linux (x86_64)',
    'linux-arm64': 'Linux (ARM64)',
    'ios-arm64': 'iOS',
    'android-arm64': 'Android'
  };

  // Identify which platform key an asset belongs to (best effort)
  function classifyAsset(asset) {
    var name = asset.name.toLowerCase();
    var results = [];

    // iOS
    if (/\.ipa$/i.test(name)) {
      results.push('ios-arm64');
    }
    // Android
    if (/\.apk$|\.aab$/i.test(name)) {
      results.push('android-arm64');
    }
    // macOS
    if (/\.dmg$|\.pkg$|macos|darwin/i.test(name)) {
      if (/aarch64|arm64/i.test(name)) results.push('macos-arm64');
      else if (/x86[_-]?64|amd64|intel/i.test(name)) results.push('macos-x64');
      else { results.push('macos-arm64'); results.push('macos-x64'); } // universal
    }
    // Windows
    if (/\.exe$|\.msi$|windows|win32|win64/i.test(name)) {
      if (/arm64/i.test(name)) results.push('windows-arm64');
      else results.push('windows-x64');
    }
    // Linux
    if (/\.deb$|\.rpm$|\.appimage$|\.flatpak$|\.snap$|\.pkg\.tar\.\w+$|linux/i.test(name)) {
      if (/aarch64|arm64/i.test(name)) results.push('linux-arm64');
      else if (/x86[_-]?64|amd64/i.test(name)) results.push('linux-x64');
      else { results.push('linux-x64'); } // assume x64 if unspecified
    }

    return results;
  }

  function buildAssetLabel(asset) {
    var ext = asset.name.match(/\.[^.]+$/);
    ext = ext ? ext[0] : '';
    var sizeMB = asset.size ? ' (' + (asset.size / 1048576).toFixed(1) + ' MB)' : '';
    return asset.name + sizeMB;
  }

  DownloadLatest.prototype.attachSelector = function (selectorOrEl, opts) {
    var el = typeof selectorOrEl === 'string'
      ? document.querySelector(selectorOrEl)
      : selectorOrEl;
    if (!el) return;

    opts = opts || {};
    var includePlatforms = opts.include || null; // array of platform keys to include
    var excludePlatforms = opts.exclude || [];   // array of platform keys to exclude

    var self = this;
    this.get().then(function (result) {
      var assets = result.allAssets;
      if (!assets.length) return;

      // Group assets by platform
      var grouped = {};
      var platformOrder = ['macos-arm64', 'macos-x64', 'windows-x64', 'windows-arm64', 'linux-x64', 'linux-arm64', 'ios-arm64', 'android-arm64'];

      for (var i = 0; i < assets.length; i++) {
        var platforms = classifyAsset(assets[i]);
        for (var j = 0; j < platforms.length; j++) {
          var pk = platforms[j];
          if (excludePlatforms.indexOf(pk) !== -1) continue;
          if (includePlatforms && includePlatforms.indexOf(pk) === -1) continue;
          if (!grouped[pk]) grouped[pk] = [];
          grouped[pk].push(assets[i]);
        }
      }

      // Build select element
      var select = document.createElement('select');
      select.className = 'dl-latest-selector';
      select.style.cssText = opts.style || '';

      var detectedKey = result.os && result.arch ? (result.os + '-' + result.arch) : null;
      var firstMatchValue = null;

      for (var pi = 0; pi < platformOrder.length; pi++) {
        var pk2 = platformOrder[pi];
        if (!grouped[pk2]) continue;
        var optgroup = document.createElement('optgroup');
        optgroup.label = PLATFORM_LABELS[pk2] || pk2;

        for (var ai = 0; ai < grouped[pk2].length; ai++) {
          var a = grouped[pk2][ai];
          var option = document.createElement('option');
          option.value = a.url;
          option.textContent = buildAssetLabel(a);
          if (pk2 === detectedKey && !firstMatchValue) {
            option.selected = true;
            firstMatchValue = a.url;
          }
          optgroup.appendChild(option);
        }
        select.appendChild(optgroup);
      }

      // Also add any unclassified assets (unless 'other' is excluded)
      var excludeOther = excludePlatforms.indexOf('other') !== -1;
      var classified = {};
      for (var k in grouped) {
        for (var ci = 0; ci < grouped[k].length; ci++) {
          classified[grouped[k][ci].name] = true;
        }
      }
      var unclassified = [];
      if (!excludeOther) {
        for (var ui = 0; ui < assets.length; ui++) {
          if (!classified[assets[ui].name]) unclassified.push(assets[ui]);
        }
      }
      if (unclassified.length) {
        var otherGroup = document.createElement('optgroup');
        otherGroup.label = 'Other';
        for (var oi = 0; oi < unclassified.length; oi++) {
          var opt2 = document.createElement('option');
          opt2.value = unclassified[oi].url;
          opt2.textContent = buildAssetLabel(unclassified[oi]);
          otherGroup.appendChild(opt2);
        }
        select.appendChild(otherGroup);
      }

      // Download button next to selector
      var dlBtn = document.createElement('a');
      dlBtn.className = 'dl-latest-btn';
      dlBtn.href = select.value || result.releasesUrl;
      dlBtn.textContent = opts.buttonText || 'Download';
      if (opts.buttonStyle) {
        dlBtn.style.cssText = opts.buttonStyle;
      }

      select.addEventListener('change', function () {
        dlBtn.href = this.value;
      });

      el.innerHTML = '';
      el.appendChild(select);
      el.appendChild(dlBtn);
    });
  };

  // --- Default button styles (CSS custom properties for theming) ---

  var stylesInjected = false;
  function injectStyles(theme) {
    if (stylesInjected) return;
    stylesInjected = true;

    var lightVars = '--dl-bg:#fff;--dl-color:#000;--dl-radius:8px;';
    var darkVars = '--dl-bg:#24292f;--dl-color:#fff;--dl-radius:8px;';
    var css = '.dl-latest-btn{display:inline-block;padding:12px 24px;' +
      'background:var(--dl-bg);color:var(--dl-color);border-radius:var(--dl-radius);' +
      'text-decoration:none;font:600 16px/1 system-ui,sans-serif;cursor:pointer;' +
      'border:none;transition:opacity .15s}' +
      '.dl-latest-btn:hover{opacity:.85;text-decoration:none}';

    if (theme === 'auto') {
      css = ':root{' + lightVars + '}' +
        '@media(prefers-color-scheme:dark){:root{' + darkVars + '}}' + css;
    } else if (theme === 'dark') {
      css = ':root{' + darkVars + '}' + css;
    } else {
      // light or unset — default
      css = ':root{' + lightVars + '}' + css;
    }

    var style = document.createElement('style');
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  // --- Auto-init from data-* attributes ---

  var initScript = (typeof document !== 'undefined') ? document.currentScript : null;

  function autoInit() {
    if (!initScript || !initScript.dataset || !initScript.dataset.repo) return;

    var ds = initScript.dataset;
    var dl = new DownloadLatest({
      repo: ds.repo,
      version: ds.version || null,
      pattern: ds.pattern || null,
      text: ds.text || 'Download for {os}',
      noMatchText: ds.noMatchText || undefined,
      noMatchUrl: ds.noMatchUrl || undefined,
      contextMenu: 'contextMenu' in ds
    });

    if ('auto' in ds) {
      // Auto-redirect mode
      dl.get().then(function (result) {
        if (result.matched) {
          setTimeout(function () { window.location.replace(result.url); }, 1500);
        }
      });
      return;
    }

    if (ds.target) {
      dl.attach(ds.target);
    } else {
      // Create inline button with CSS-variable-based styling
      injectStyles(ds.theme || '');
      var btn = document.createElement('a');
      btn.className = 'dl-latest-btn';
      btn.textContent = 'Download';
      initScript.parentNode.insertBefore(btn, initScript.nextSibling);
      dl.attach(btn);
    }

    if (ds.fallback) {
      dl.attachFallback(ds.fallback);
    }

    if (ds.selector) {
      dl.attachSelector(ds.selector);
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', autoInit);
    } else {
      autoInit();
    }
  }

  // Expose internals for testing
  DownloadLatest.detectPlatform = detectPlatform;
  DownloadLatest.matchAsset = matchAsset;
  DownloadLatest.filterAssets = filterAssets;
  DownloadLatest.classifyAsset = classifyAsset;
  DownloadLatest.DEFAULT_MATCH = DEFAULT_MATCH;

  return DownloadLatest;
}));
