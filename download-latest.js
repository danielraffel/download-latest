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
        if (ua.indexOf('mac') !== -1) os = 'macos';
        else if (ua.indexOf('win') !== -1) os = 'windows';
        else if (ua.indexOf('linux') !== -1 || ua.indexOf('cros') !== -1) os = 'linux';
      }

      if (!arch) {
        if (ua.indexOf('arm') !== -1 || ua.indexOf('aarch64') !== -1) arch = 'arm64';
        else if (plat.indexOf('arm') !== -1) arch = 'arm64';
        else if (os === 'macos') arch = 'arm64'; // Apple Silicon is the majority now
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
    'linux-arm64':   [/[-_.]aarch64[^/]*\.AppImage$/i, /[-_.]arm64[^/]*\.deb$/i, /[-_.]aarch64[^/]*\.deb$/i, /[-_.]aarch64[^/]*\.rpm$/i]
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
    this.text = config.text || 'Download for {os}';
    this._releasesUrl = 'https://github.com/' + this.repo + '/releases' + (this.version ? '/tag/' + this.version : '/latest');
    this._promise = null;
  }

  DownloadLatest.prototype.get = function () {
    if (this._promise) return this._promise;
    var self = this;
    var platform = detectPlatform();

    this._promise = fetchRelease(this.repo, this.version).then(function (release) {
      var asset = (platform.os && platform.arch)
        ? matchAsset(release.assets, platform.os, platform.arch, self.match)
        : null;

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
      if (el.tagName === 'A') {
        el.href = result.url;
      } else {
        el.style.cursor = 'pointer';
        el.onclick = function () { window.location.href = result.url; };
      }

      var osLabels = { macos: 'macOS', windows: 'Windows', linux: 'Linux' };
      var label = osLabels[result.os] || 'your platform';
      el.textContent = self.text
        .replace('{os}', label)
        .replace('{arch}', result.arch || '')
        .replace('{version}', result.version || '');

      el.setAttribute('data-dl-os', result.os || '');
      el.setAttribute('data-dl-arch', result.arch || '');
      el.title = result.asset || 'View releases';

      // Long-press / right-click context: link to releases page
      el.addEventListener('contextmenu', function (e) {
        if (result.releasesUrl) {
          e.preventDefault();
          window.open(result.releasesUrl, '_blank');
        }
      });
    });
  };

  DownloadLatest.prototype.attachFallback = function (selectorOrEl) {
    var el = typeof selectorOrEl === 'string'
      ? document.querySelector(selectorOrEl)
      : selectorOrEl;
    if (!el) return;

    this.get().then(function (result) {
      el.innerHTML = '';
      var assets = result.allAssets;
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

  // --- Auto-init from data-* attributes ---

  var initScript = (typeof document !== 'undefined') ? document.currentScript : null;

  function autoInit() {
    if (!initScript || !initScript.dataset || !initScript.dataset.repo) return;

    var ds = initScript.dataset;
    var dl = new DownloadLatest({
      repo: ds.repo,
      version: ds.version || null,
      text: ds.text || 'Download for {os}'
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
      // Create inline button
      var btn = document.createElement('a');
      btn.className = 'dl-latest-btn';
      btn.textContent = 'Download';
      btn.style.cssText = 'display:inline-block;padding:12px 24px;background:#fff;color:#000;' +
        'border-radius:8px;text-decoration:none;font:600 16px/1 system-ui,sans-serif;cursor:pointer;';
      initScript.parentNode.insertBefore(btn, initScript.nextSibling);
      dl.attach(btn);
    }

    if (ds.fallback) {
      dl.attachFallback(ds.fallback);
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
  DownloadLatest.DEFAULT_MATCH = DEFAULT_MATCH;

  return DownloadLatest;
}));
