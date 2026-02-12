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
  var advPatternInput = document.getElementById('cfg-adv-pattern');
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
  var advSelectorInput = document.getElementById('cfg-adv-selector');

  var advPatternFieldEl = document.getElementById('cfg-adv-pattern-field');
  var advTextFieldEl = document.getElementById('cfg-adv-text-field');
  var advStyleFieldsEl = document.getElementById('cfg-adv-style-fields');
  var advThemeFieldEl = document.getElementById('cfg-adv-theme-field');
  var advNoMatchFieldEl = document.getElementById('cfg-adv-nomatch-field');
  var advNoMatchUrlFieldEl = document.getElementById('cfg-adv-nomatch-url-field');
  var advContextMenuFieldEl = document.getElementById('cfg-adv-context-menu-field');
  var advSelectorFieldEl = document.getElementById('cfg-adv-selector-field');

  // Platform overrides with checkboxes
  var ALL_PLATFORMS = ['macos-arm64', 'macos-x64', 'windows-x64', 'windows-arm64', 'linux-x64', 'linux-arm64', 'ios-arm64', 'android-arm64', 'other'];

  var overrideFields = {};
  var platformToggles = {};
  ALL_PLATFORMS.forEach(function (key) {
    overrideFields[key] = document.getElementById('cfg-match-' + key);
    var toggle = document.querySelector('.cfg-platform-toggle[data-platform="' + key + '"]');
    if (toggle) platformToggles[key] = toggle;
  });

  var lastRelease = null;

  function getVal(name) {
    var el = document.querySelector('[name="' + name + '"]:checked');
    return el ? el.value : '';
  }

  function getOverrides() {
    var m = {};
    var hasAny = false;
    for (var key in overrideFields) {
      if (!overrideFields[key]) continue;
      // Only include overrides for enabled platforms
      var toggle = platformToggles[key];
      if (toggle && !toggle.checked) continue;
      var v = overrideFields[key].value.trim();
      if (v) { m[key] = v; hasAny = true; }
    }
    return hasAny ? m : null;
  }

  // Returns list of platform keys that are unchecked (excluded)
  function getExcludedPlatforms() {
    var excluded = [];
    for (var key in platformToggles) {
      if (!platformToggles[key].checked) excluded.push(key);
    }
    return excluded;
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // --- Platform toggle visual state ---

  function updatePlatformFieldStates() {
    for (var key in platformToggles) {
      var field = platformToggles[key].closest('.platform-field');
      if (field) {
        if (platformToggles[key].checked) {
          field.classList.remove('disabled');
        } else {
          field.classList.add('disabled');
        }
      }
    }
  }

  // --- Advanced section visibility ---

  function updateAdvancedVisibility() {
    var mode = getVal('cfg-mode');
    // Pattern mode: shows pattern field + text + style
    var hasPattern = (mode === 'pattern');
    // Modes that show button styling: button, pattern (pattern creates a button too)
    var hasButtonStyle = (mode === 'button' || mode === 'pattern');
    // Modes that show text customization: button, custom, pattern
    var hasText = (mode === 'button' || mode === 'custom' || mode === 'pattern');
    // Modes that show no-match options: button, custom, pattern
    var hasNoMatch = (mode === 'button' || mode === 'custom' || mode === 'pattern');
    // Modes that can use context menu: button, custom
    var hasContextMenu = (mode === 'button' || mode === 'custom');
    // Modes that can show platform selector: button, custom
    var hasSelector = (mode === 'button' || mode === 'custom');
    // Modes with nothing relevant in Advanced
    var isEmpty = !hasText && !hasButtonStyle && !hasNoMatch && !hasContextMenu && !hasSelector && !hasPattern;

    advPatternFieldEl.style.display = hasPattern ? '' : 'none';
    advTextFieldEl.style.display = hasText ? '' : 'none';
    advStyleFieldsEl.style.display = hasButtonStyle ? '' : 'none';
    advThemeFieldEl.style.display = hasButtonStyle ? '' : 'none';
    advNoMatchFieldEl.style.display = hasNoMatch ? '' : 'none';
    advNoMatchUrlFieldEl.style.display = hasNoMatch ? '' : 'none';
    advContextMenuFieldEl.style.display = hasContextMenu ? '' : 'none';
    advSelectorFieldEl.style.display = hasSelector ? '' : 'none';

    if (isEmpty) {
      advancedEl.setAttribute('data-empty', '');
      advancedEl.removeAttribute('open');
    } else {
      advancedEl.removeAttribute('data-empty');
    }

    // For pattern mode, auto-open advanced so the pattern field is visible
    if (hasPattern) {
      advancedEl.setAttribute('open', '');
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
    var pattern = advPatternInput.value.trim();
    var text = advTextInput.value.trim();
    var bg = advBgInput.value.trim();
    var fg = advFgInput.value.trim();
    var radius = advRadiusInput.value.trim();
    var noMatchText = advNoMatchTextInput.value.trim();
    var noMatchUrl = advNoMatchUrlInput.value.trim();
    var theme = getVal('cfg-theme');
    var contextMenu = advContextMenuInput.checked;
    var showSelector = advSelectorInput.checked;
    return { pattern: pattern, text: text, bg: bg, fg: fg, radius: radius, noMatchText: noMatchText, noMatchUrl: noMatchUrl, theme: theme, contextMenu: contextMenu, showSelector: showSelector };
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
    var excluded = getExcludedPlatforms();
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
    var needsProgrammatic = overrides || excluded.length > 0 || mode === 'url' || mode === 'pattern' ||
      (mode === 'button' && (adv.bg || adv.fg || adv.radius)) ||
      adv.noMatchText || adv.noMatchUrl || adv.contextMenu || adv.showSelector;

    if (needsProgrammatic) {
      var configLines = ['  repo: \'' + repo + '\''];
      if (version === 'pinned' && tag) {
        configLines.push('  version: \'' + tag + '\'');
      }
      if (mode === 'pattern' && adv.pattern) {
        configLines.push('  pattern: /' + adv.pattern + '/i');
      }
      if (adv.text) {
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

      // Build exclude options string for selector and fallback
      var excludeOptsStr = '';
      if (excluded.length > 0) {
        excludeOptsStr = '{ exclude: [\'' + excluded.join('\', \'') + '\'] }';
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
        var fallbackOpts = excludeOptsStr ? ', ' + excludeOptsStr : '';
        snippet = '<div id="downloads"></div>\n<script src="' + src + '"><\/script>\n<script>\n' +
          '  const dl = new DownloadLatest({\n' + configLines.join(',\n') + '\n  });\n' +
          '  dl.attachFallback(\'#downloads\'' + fallbackOpts + ');\n<\/script>';
      } else if (mode === 'pattern') {
        // Pattern mode: creates a button that links to a specific file
        var styleStr = buildStyleAttr(adv);
        var elTag = '<a id="dl" href="#">Download</a>';
        if (styleStr) {
          elTag = '<a id="dl" href="#" style="' + styleStr + '">Download</a>';
        }
        snippet = elTag + '\n<script src="' + src + '"><\/script>\n<script>\n' +
          '  const dl = new DownloadLatest({\n' + configLines.join(',\n') + '\n  });\n' +
          '  dl.attach(\'#dl\');\n<\/script>';
      } else if (adv.showSelector) {
        // Selector mode: dropdown replaces standalone button
        var selectorOptsStr2 = excludeOptsStr ? ', ' + excludeOptsStr : '';
        snippet = '<div id="dl-selector"></div>\n<script src="' + src + '"><\/script>\n<script>\n' +
          '  const dl = new DownloadLatest({\n' + configLines.join(',\n') + '\n  });\n' +
          '  dl.attachSelector(\'#dl-selector\'' + selectorOptsStr2 + ');\n<\/script>';
      } else {
        // button or custom with programmatic
        var styleStr2 = buildStyleAttr(adv);
        var elTag2 = '<a id="dl" href="#">Download</a>';
        if (styleStr2) {
          elTag2 = '<a id="dl" href="#" style="' + styleStr2 + '">Download</a>';
        }
        snippet = elTag2 + '\n<script src="' + src + '"><\/script>\n<script>\n' +
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

      snippet = '';
      if (mode === 'fallback') snippet += '<div id="downloads"></div>\n';
      if (mode === 'custom') snippet += '<a id="your-button" href="#">Download</a>\n';
      snippet += '<script\n' + attrs.join('\n') + '\n><\/script>';
    }

    outputCode.textContent = snippet;

    // Update preview
    updatePreview(repo, mode, adv, excluded);
  }

  function updatePreview(repo, mode, adv, excluded) {
    previewEl.innerHTML = '';
    if (!repo) return;

    if (mode === 'fallback') {
      var div = document.createElement('div');
      div.id = 'preview-fallback';
      div.style.textAlign = 'left';
      div.textContent = 'Loading assets\u2026';
      previewEl.appendChild(div);
      var cfg = { repo: repo };
      var dl = new DownloadLatest(cfg);
      var fallbackOpts = {};
      if (excluded && excluded.length > 0) fallbackOpts.exclude = excluded;
      dl.attachFallback(div, fallbackOpts);
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
    } else if (mode === 'pattern') {
      // Pattern mode preview: show button linking to matched file
      var btn = document.createElement('a');
      btn.className = 'dl-latest-btn';
      btn.href = '#';
      btn.textContent = 'Loading\u2026';
      if (adv && adv.bg) btn.style.background = adv.bg;
      if (adv && adv.fg) btn.style.color = adv.fg;
      if (adv && adv.radius) btn.style.borderRadius = adv.radius;
      previewEl.appendChild(btn);

      var patternCfg = { repo: repo };
      if (adv && adv.pattern) patternCfg.pattern = adv.pattern;
      if (adv && adv.text) patternCfg.text = adv.text;
      if (adv && adv.noMatchText) patternCfg.noMatchText = adv.noMatchText;
      if (adv && adv.noMatchUrl) patternCfg.noMatchUrl = adv.noMatchUrl;
      var dl4 = new DownloadLatest(patternCfg);
      dl4.attach(btn);
    } else if (adv && adv.showSelector) {
      // Selector mode: just the dropdown, no standalone button
      var selectorDiv = document.createElement('div');
      previewEl.appendChild(selectorDiv);
      var cfg2 = { repo: repo };
      if (adv.text) cfg2.text = adv.text;
      if (adv.noMatchText) cfg2.noMatchText = adv.noMatchText;
      if (adv.noMatchUrl) cfg2.noMatchUrl = adv.noMatchUrl;
      var dl3 = new DownloadLatest(cfg2);
      var selectorOpts = {};
      if (excluded && excluded.length > 0) selectorOpts.exclude = excluded;
      dl3.attachSelector(selectorDiv, selectorOpts);
    } else {
      // button or custom mode
      var btn2 = document.createElement('a');
      btn2.className = 'dl-latest-btn';
      btn2.href = '#';
      btn2.textContent = 'Loading\u2026';
      // Apply advanced styles to preview
      if (adv && adv.bg) btn2.style.background = adv.bg;
      if (adv && adv.fg) btn2.style.color = adv.fg;
      if (adv && adv.radius) btn2.style.borderRadius = adv.radius;
      previewEl.appendChild(btn2);

      var cfg3 = { repo: repo };
      if (adv && adv.text) cfg3.text = adv.text;
      if (adv && adv.noMatchText) cfg3.noMatchText = adv.noMatchText;
      if (adv && adv.noMatchUrl) cfg3.noMatchUrl = adv.noMatchUrl;
      var dl5 = new DownloadLatest(cfg3);
      dl5.attach(btn2);
    }
  }

  // --- Event listeners ---

  repoInput.addEventListener('input', generate);
  versionTag.addEventListener('input', generate);
  advPatternInput.addEventListener('input', generate);
  advTextInput.addEventListener('input', generate);
  advRadiusInput.addEventListener('input', generate);
  advNoMatchTextInput.addEventListener('input', generate);
  advNoMatchUrlInput.addEventListener('input', generate);
  advContextMenuInput.addEventListener('change', generate);
  advSelectorInput.addEventListener('change', generate);
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
    if (overrideFields[key]) overrideFields[key].addEventListener('input', generate);
  }
  for (var pk in platformToggles) {
    platformToggles[pk].addEventListener('change', function () {
      updatePlatformFieldStates();
      generate();
    });
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
  updatePlatformFieldStates();
  generate();
})();
