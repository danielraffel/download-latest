/* Configurator for download-latest */
(function () {
  'use strict';

  var repoInput = document.getElementById('cfg-repo');
  var testBtn = document.getElementById('cfg-test');
  var assetsInfo = document.getElementById('cfg-assets');
  var modeRadios = document.querySelectorAll('[name="cfg-mode"]');
  var sourceRadios = document.querySelectorAll('[name="cfg-source"]');
  var versionRadios = document.querySelectorAll('[name="cfg-version"]');
  var versionTag = document.getElementById('cfg-version-tag');
  var outputCode = document.getElementById('cfg-output-code');
  var copyBtn = document.getElementById('cfg-copy');
  var iconCopy = copyBtn.querySelector('.icon-copy');
  var iconCheck = copyBtn.querySelector('.icon-check');
  var previewEl = document.getElementById('cfg-preview');

  // Advanced section
  var advancedEl = document.getElementById('cfg-advanced');
  var advTextInput = document.getElementById('cfg-adv-text');
  var advBgInput = document.getElementById('cfg-adv-bg');
  var advBgPicker = document.getElementById('cfg-adv-bg-picker');
  var advFgInput = document.getElementById('cfg-adv-fg');
  var advFgPicker = document.getElementById('cfg-adv-fg-picker');
  var advRadiusInput = document.getElementById('cfg-adv-radius');
  var themeRadios = document.querySelectorAll('[name="cfg-theme"]');
  var advNoMatchTextInput = document.getElementById('cfg-adv-nomatch-text');
  var advNoMatchUrlInput = document.getElementById('cfg-adv-nomatch-url');
  var advContextMenuInput = document.getElementById('cfg-adv-context-menu');

  var advTextFieldEl = document.getElementById('cfg-adv-text-field');
  var advStyleFieldsEl = document.getElementById('cfg-adv-style-fields');
  var advThemeFieldEl = document.getElementById('cfg-adv-theme-field');
  var advNoMatchFieldEl = document.getElementById('cfg-adv-nomatch-field');
  var advNoMatchUrlFieldEl = document.getElementById('cfg-adv-nomatch-url-field');
  var advContextMenuFieldEl = document.getElementById('cfg-adv-context-menu-field');

  var overrideFields = {
    'macos-arm64': document.getElementById('cfg-match-macos-arm64'),
    'macos-x64': document.getElementById('cfg-match-macos-x64'),
    'windows-x64': document.getElementById('cfg-match-windows-x64'),
    'linux-x64': document.getElementById('cfg-match-linux-x64'),
    'linux-arm64': document.getElementById('cfg-match-linux-arm64')
  };

  var lastRelease = null;

  function getVal(name) {
    var el = document.querySelector('[name="' + name + '"]:checked');
    return el ? el.value : '';
  }

  function getOverrides() {
    var m = {};
    var hasAny = false;
    for (var key in overrideFields) {
      var v = overrideFields[key].value.trim();
      if (v) { m[key] = v; hasAny = true; }
    }
    return hasAny ? m : null;
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // --- Advanced section visibility ---

  function updateAdvancedVisibility() {
    var mode = getVal('cfg-mode');
    // Modes that show button styling: button only (user styles their own element in custom mode)
    var hasButtonStyle = (mode === 'button');
    // Modes that show text customization: button, custom (lets user put OS-detected text on their own element)
    var hasText = (mode === 'button' || mode === 'custom');
    // Modes that show no-match options: button, custom (these show a button that may say wrong thing)
    var hasNoMatch = (mode === 'button' || mode === 'custom');
    // Modes that can use context menu: button, custom
    var hasContextMenu = (mode === 'button' || mode === 'custom');
    // Modes with nothing relevant in Advanced
    var isEmpty = !hasText && !hasButtonStyle && !hasNoMatch && !hasContextMenu;

    advTextFieldEl.style.display = hasText ? '' : 'none';
    advStyleFieldsEl.style.display = hasButtonStyle ? '' : 'none';
    advThemeFieldEl.style.display = hasButtonStyle ? '' : 'none';
    advNoMatchFieldEl.style.display = hasNoMatch ? '' : 'none';
    advNoMatchUrlFieldEl.style.display = hasNoMatch ? '' : 'none';
    advContextMenuFieldEl.style.display = hasContextMenu ? '' : 'none';

    if (isEmpty) {
      advancedEl.setAttribute('data-empty', '');
      advancedEl.removeAttribute('open');
    } else {
      advancedEl.removeAttribute('data-empty');
    }
  }

  // --- Theme presets ---

  function applyTheme(theme) {
    if (theme === 'light' || theme === '') {
      advBgInput.value = '';
      advFgInput.value = '';
      advBgPicker.value = '#ffffff';
      advFgPicker.value = '#000000';
    } else if (theme === 'dark') {
      advBgInput.value = '';
      advFgInput.value = '';
      advBgPicker.value = '#24292f';
      advFgPicker.value = '#ffffff';
    } else if (theme === 'auto') {
      advBgInput.value = '';
      advFgInput.value = '';
      advBgPicker.value = '#ffffff';
      advFgPicker.value = '#000000';
    }
    generate();
  }

  // Color picker sync
  advBgPicker.addEventListener('input', function () { advBgInput.value = this.value; generate(); });
  advFgPicker.addEventListener('input', function () { advFgInput.value = this.value; generate(); });
  advBgInput.addEventListener('input', function () {
    if (/^#[0-9a-f]{6}$/i.test(this.value)) advBgPicker.value = this.value;
    generate();
  });
  advFgInput.addEventListener('input', function () {
    if (/^#[0-9a-f]{6}$/i.test(this.value)) advFgPicker.value = this.value;
    generate();
  });

  // --- Test repo ---

  testBtn.addEventListener('click', async function () {
    var repo = repoInput.value.trim();
    if (!repo || repo.indexOf('/') === -1) {
      assetsInfo.innerHTML = '<span style="color:var(--red)">Enter a valid owner/repo</span>';
      return;
    }

    assetsInfo.textContent = 'Fetching\u2026';
    try {
      var res = await fetch('https://api.github.com/repos/' + repo + '/releases/latest', {
        headers: { 'Accept': 'application/vnd.github+json' }
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      lastRelease = data;

      var assets = (data.assets || []).filter(function (a) {
        return !/\.(sha256|sha512|sig|asc|blockmap|zsync)$/i.test(a.name);
      });

      versionTag.value = data.tag_name;
      assetsInfo.innerHTML = '<span class="count">' + assets.length + ' assets</span> found in ' +
        '<strong>' + escapeHtml(data.tag_name) + '</strong>: ' +
        assets.map(function (a) { return '<code>' + escapeHtml(a.name) + '</code>'; }).join(', ');

      generate();
    } catch (e) {
      assetsInfo.innerHTML = '<span style="color:var(--red)">Error: ' + escapeHtml(e.message) + '</span>';
    }
  });

  // --- Generate snippet ---

  function getAdvancedConfig() {
    var text = advTextInput.value.trim();
    var bg = advBgInput.value.trim();
    var fg = advFgInput.value.trim();
    var radius = advRadiusInput.value.trim();
    var noMatchText = advNoMatchTextInput.value.trim();
    var noMatchUrl = advNoMatchUrlInput.value.trim();
    var theme = getVal('cfg-theme');
    var contextMenu = advContextMenuInput.checked;
    return { text: text, bg: bg, fg: fg, radius: radius, noMatchText: noMatchText, noMatchUrl: noMatchUrl, theme: theme, contextMenu: contextMenu };
  }

  function buildStyleAttr(adv) {
    var parts = [];
    if (adv.bg) parts.push('background:' + adv.bg);
    if (adv.fg) parts.push('color:' + adv.fg);
    if (adv.radius) parts.push('border-radius:' + adv.radius);
    return parts.length ? parts.join(';') : '';
  }

  function generate() {
    var repo = repoInput.value.trim();
    if (!repo) { outputCode.textContent = ''; return; }

    var mode = getVal('cfg-mode');
    var source = getVal('cfg-source');
    var version = getVal('cfg-version');
    var tag = versionTag.value.trim();
    var overrides = getOverrides();
    var adv = getAdvancedConfig();

    // Build src URL
    var src;
    var jsFile = 'download-latest.min.js';
    var versionPart = (version === 'pinned' && tag) ? tag : 'main';

    if (source === 'jsdelivr') {
      src = 'https://cdn.jsdelivr.net/gh/danielraffel/download-latest@' + versionPart + '/' + jsFile;
    } else if (source === 'raw') {
      src = 'https://raw.githubusercontent.com/danielraffel/download-latest/' + versionPart + '/' + jsFile;
    } else {
      src = jsFile;
    }

    var snippet;

    // Determine if we need programmatic mode
    var needsProgrammatic = overrides || mode === 'url' || mode === 'selector' ||
      (mode === 'button' && (adv.bg || adv.fg || adv.radius)) ||
      adv.noMatchText || adv.noMatchUrl || adv.contextMenu;

    if (needsProgrammatic) {
      var configLines = ['  repo: \'' + repo + '\''];
      if (version === 'pinned' && tag) {
        configLines.push('  version: \'' + tag + '\'');
      }
      if (adv.text && mode !== 'selector') {
        configLines.push('  text: \'' + adv.text.replace(/'/g, "\\'") + '\'');
      }
      if (adv.noMatchText) {
        configLines.push('  noMatchText: \'' + adv.noMatchText.replace(/'/g, "\\'") + '\'');
      }
      if (adv.noMatchUrl) {
        configLines.push('  noMatchUrl: \'' + adv.noMatchUrl.replace(/'/g, "\\'") + '\'');
      }
      if (adv.contextMenu) {
        configLines.push('  contextMenu: true');
      }
      if (overrides) {
        var matchLines = [];
        for (var key in overrides) {
          matchLines.push('    \'' + key + '\': /' + overrides[key] + '/i');
        }
        configLines.push('  match: {\n' + matchLines.join(',\n') + '\n  }');
      }

      if (mode === 'url') {
        snippet = '<script src="' + src + '"><\/script>\n<script>\n' +
          '  const dl = new DownloadLatest({\n' + configLines.join(',\n') + '\n  });\n' +
          '  dl.get().then(r => console.log(r.url));\n<\/script>';
      } else if (mode === 'auto') {
        snippet = '<script src="' + src + '"><\/script>\n<script>\n' +
          '  const dl = new DownloadLatest({\n' + configLines.join(',\n') + '\n  });\n' +
          '  dl.get().then(r => { if (r.matched) location.replace(r.url); });\n<\/script>';
      } else if (mode === 'fallback') {
        snippet = '<div id="downloads"></div>\n<script src="' + src + '"><\/script>\n<script>\n' +
          '  const dl = new DownloadLatest({\n' + configLines.join(',\n') + '\n  });\n' +
          '  dl.attachFallback(\'#downloads\');\n<\/script>';
      } else if (mode === 'selector') {
        snippet = '<div id="download-selector"></div>\n<script src="' + src + '"><\/script>\n<script>\n' +
          '  const dl = new DownloadLatest({\n' + configLines.join(',\n') + '\n  });\n' +
          '  dl.attachSelector(\'#download-selector\');\n<\/script>';
      } else {
        // button or custom with programmatic
        var styleStr = buildStyleAttr(adv);
        var elTag = '<a id="dl" href="#">Download</a>';
        if (styleStr) {
          elTag = '<a id="dl" href="#" style="' + styleStr + '">Download</a>';
        }
        snippet = elTag + '\n<script src="' + src + '"><\/script>\n<script>\n' +
          '  const dl = new DownloadLatest({\n' + configLines.join(',\n') + '\n  });\n' +
          '  dl.attach(\'#dl\');\n<\/script>';
      }
    } else {
      // Simple data-attribute approach
      var attrs = ['  src="' + src + '"', '  data-repo="' + repo + '"'];
      if (version === 'pinned' && tag) {
        attrs.push('  data-version="' + tag + '"');
      }
      if (adv.text) {
        attrs.push('  data-text="' + adv.text.replace(/"/g, '&quot;') + '"');
      }
      if (adv.theme && mode === 'button') {
        attrs.push('  data-theme="' + adv.theme + '"');
      }
      if (mode === 'auto') attrs.push('  data-auto');
      if (mode === 'fallback') attrs.push('  data-fallback="#downloads"');
      if (mode === 'custom') attrs.push('  data-target="#your-button"');
      if (mode === 'selector') attrs.push('  data-selector="#download-selector"');

      snippet = '';
      if (mode === 'fallback') snippet += '<div id="downloads"></div>\n';
      if (mode === 'custom') snippet += '<a id="your-button" href="#">Download</a>\n';
      if (mode === 'selector') snippet += '<div id="download-selector"></div>\n';
      snippet += '<script\n' + attrs.join('\n') + '\n><\/script>';
    }

    outputCode.textContent = snippet;

    // Update preview
    updatePreview(repo, mode, adv);
  }

  function updatePreview(repo, mode, adv) {
    previewEl.innerHTML = '';
    if (!repo) return;

    if (mode === 'fallback') {
      var div = document.createElement('div');
      div.id = 'preview-fallback';
      div.style.textAlign = 'left';
      div.textContent = 'Loading assets\u2026';
      previewEl.appendChild(div);
      var dl = new DownloadLatest({ repo: repo });
      dl.attachFallback(div);
    } else if (mode === 'selector') {
      var selectorDiv = document.createElement('div');
      selectorDiv.style.textAlign = 'left';
      selectorDiv.textContent = 'Loading assets\u2026';
      previewEl.appendChild(selectorDiv);
      var dlSel = new DownloadLatest({ repo: repo });
      dlSel.attachSelector(selectorDiv);
    } else if (mode === 'auto' || mode === 'url') {
      var info = document.createElement('div');
      info.style.color = 'var(--text-muted)';
      info.style.fontSize = '14px';
      info.textContent = 'Detecting\u2026';
      var dl2 = new DownloadLatest({ repo: repo });
      dl2.get().then(function (r) {
        if (mode === 'auto') {
          if (r.matched) {
            info.innerHTML = 'Download will auto-start: <strong>' + escapeHtml(r.asset) + '</strong>';
          } else {
            info.textContent = 'No match for this platform \u2014 visitor will see the releases page';
          }
        } else {
          info.innerHTML = 'URL: <a href="' + escapeHtml(r.url) + '" style="word-break:break-all">' + escapeHtml(r.url) + '</a>';
        }
      });
      previewEl.appendChild(info);
    } else {
      var btn = document.createElement('a');
      btn.className = 'dl-latest-btn';
      btn.href = '#';
      btn.textContent = 'Loading\u2026';
      // Apply advanced styles to preview
      if (adv && adv.bg) btn.style.background = adv.bg;
      if (adv && adv.fg) btn.style.color = adv.fg;
      if (adv && adv.radius) btn.style.borderRadius = adv.radius;
      previewEl.appendChild(btn);
      var cfg = { repo: repo };
      if (adv && adv.text) cfg.text = adv.text;
      if (adv && adv.noMatchText) cfg.noMatchText = adv.noMatchText;
      if (adv && adv.noMatchUrl) cfg.noMatchUrl = adv.noMatchUrl;
      var dl3 = new DownloadLatest(cfg);
      dl3.attach(btn);
    }
  }

  // --- Event listeners ---

  repoInput.addEventListener('input', generate);
  versionTag.addEventListener('input', generate);
  advTextInput.addEventListener('input', generate);
  advRadiusInput.addEventListener('input', generate);
  advNoMatchTextInput.addEventListener('input', generate);
  advNoMatchUrlInput.addEventListener('input', generate);
  advContextMenuInput.addEventListener('change', generate);
  modeRadios.forEach(function (r) { r.addEventListener('change', function () {
    updateAdvancedVisibility();
    generate();
  }); });
  sourceRadios.forEach(function (r) { r.addEventListener('change', generate); });
  versionRadios.forEach(function (r) { r.addEventListener('change', function () {
    versionTag.disabled = this.value !== 'pinned';
    generate();
  }); });
  themeRadios.forEach(function (r) { r.addEventListener('change', function () {
    applyTheme(this.value);
  }); });
  for (var key in overrideFields) {
    overrideFields[key].addEventListener('input', generate);
  }

  // Copy button with icon toggle
  copyBtn.addEventListener('click', function () {
    var text = outputCode.textContent;
    if (!text) return;
    navigator.clipboard.writeText(text).then(function () {
      iconCopy.style.display = 'none';
      iconCheck.style.display = '';
      copyBtn.classList.add('copied');
      setTimeout(function () {
        iconCopy.style.display = '';
        iconCheck.style.display = 'none';
        copyBtn.classList.remove('copied');
      }, 2000);
    });
  });

  // Initial state
  updateAdvancedVisibility();
  generate();
})();
