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
  var overridesEl = document.getElementById('cfg-overrides');
  var outputCode = document.getElementById('cfg-output-code');
  var copyBtn = document.getElementById('cfg-copy');
  var previewEl = document.getElementById('cfg-preview');

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

  // --- Test repo ---

  testBtn.addEventListener('click', async function () {
    var repo = repoInput.value.trim();
    if (!repo || repo.indexOf('/') === -1) {
      assetsInfo.innerHTML = '<span style="color:var(--red)">Enter a valid owner/repo</span>';
      return;
    }

    assetsInfo.textContent = 'Fetching…';
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

  function generate() {
    var repo = repoInput.value.trim();
    if (!repo) { outputCode.textContent = ''; return; }

    var mode = getVal('cfg-mode');
    var source = getVal('cfg-source');
    var version = getVal('cfg-version');
    var tag = versionTag.value.trim();
    var overrides = getOverrides();

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

    // If overrides are set or mode is 'url', use programmatic approach
    if (overrides || mode === 'url') {
      var configLines = ['  repo: \'' + repo + '\''];
      if (version === 'pinned' && tag) {
        configLines.push('  version: \'' + tag + '\'');
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
      } else {
        snippet = '<a id="dl" href="#">Download</a>\n<script src="' + src + '"><\/script>\n<script>\n' +
          '  const dl = new DownloadLatest({\n' + configLines.join(',\n') + '\n  });\n' +
          '  dl.attach(\'#dl\');\n<\/script>';
      }
    } else {
      // Simple data-attribute approach
      var attrs = ['  src="' + src + '"', '  data-repo="' + repo + '"'];
      if (version === 'pinned' && tag) {
        attrs.push('  data-version="' + tag + '"');
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
    updatePreview(repo, mode);
  }

  function updatePreview(repo, mode) {
    previewEl.innerHTML = '';
    if (!repo) return;

    if (mode === 'fallback') {
      var div = document.createElement('div');
      div.id = 'preview-fallback';
      div.style.textAlign = 'left';
      div.textContent = 'Loading assets…';
      previewEl.appendChild(div);
      var dl = new DownloadLatest({ repo: repo });
      dl.attachFallback(div);
    } else if (mode === 'auto' || mode === 'url') {
      var info = document.createElement('div');
      info.style.color = 'var(--text-muted)';
      info.style.fontSize = '14px';
      var dl2 = new DownloadLatest({ repo: repo });
      dl2.get().then(function (r) {
        if (mode === 'auto') {
          info.textContent = 'Would redirect to: ' + (r.asset || r.url);
        } else {
          info.textContent = 'URL: ' + r.url;
        }
      });
      previewEl.appendChild(info);
    } else {
      var btn = document.createElement('a');
      btn.className = 'dl-latest-btn';
      btn.href = '#';
      btn.textContent = 'Loading…';
      previewEl.appendChild(btn);
      var dl3 = new DownloadLatest({ repo: repo });
      dl3.attach(btn);
    }
  }

  // --- Event listeners ---

  repoInput.addEventListener('input', generate);
  versionTag.addEventListener('input', generate);
  modeRadios.forEach(function (r) { r.addEventListener('change', generate); });
  sourceRadios.forEach(function (r) { r.addEventListener('change', generate); });
  versionRadios.forEach(function (r) { r.addEventListener('change', function () {
    versionTag.disabled = this.value !== 'pinned';
    generate();
  }); });
  for (var key in overrideFields) {
    overrideFields[key].addEventListener('input', generate);
  }

  // Copy button
  copyBtn.addEventListener('click', function () {
    var text = outputCode.textContent;
    if (!text) return;
    navigator.clipboard.writeText(text).then(function () {
      copyBtn.textContent = 'Copied!';
      copyBtn.classList.add('copied');
      setTimeout(function () {
        copyBtn.textContent = 'Copy';
        copyBtn.classList.remove('copied');
      }, 2000);
    });
  });

  // Initial generation
  generate();
})();
