/* download-latest test suite — no dependencies */

(function () {
  'use strict';

  var tests = [];
  var results = { passed: 0, failed: 0, errors: [] };

  function test(name, fn) { tests.push({ name: name, fn: fn }); }
  function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
  function assertEqual(a, b, msg) {
    assert(a === b, (msg || '') + ' — expected "' + b + '", got "' + a + '"');
  }

  // --- RustDesk fixture data (real asset names from v1.4.5) ---

  var RUSTDESK_ASSETS = [
    { name: 'rustdesk-1.4.5-aarch64.dmg', browser_download_url: 'https://example.com/aarch64.dmg', size: 10000000 },
    { name: 'rustdesk-1.4.5-x86_64.dmg', browser_download_url: 'https://example.com/x86_64.dmg', size: 11000000 },
    { name: 'rustdesk-1.4.5-x86_64.exe', browser_download_url: 'https://example.com/x86_64.exe', size: 12000000 },
    { name: 'rustdesk-1.4.5-x86_64.msi', browser_download_url: 'https://example.com/x86_64.msi', size: 13000000 },
    { name: 'rustdesk-1.4.5-x86_64.AppImage', browser_download_url: 'https://example.com/x86_64.AppImage', size: 14000000 },
    { name: 'rustdesk-1.4.5-x86_64.deb', browser_download_url: 'https://example.com/x86_64.deb', size: 9000000 },
    { name: 'rustdesk-1.4.5-aarch64.AppImage', browser_download_url: 'https://example.com/aarch64.AppImage', size: 13000000 },
    { name: 'rustdesk-1.4.5-aarch64.deb', browser_download_url: 'https://example.com/aarch64.deb', size: 8000000 },
    { name: 'rustdesk-1.4.5-aarch64.rpm', browser_download_url: 'https://example.com/aarch64.rpm', size: 9500000 },
    { name: 'rustdesk-1.4.5-x86_64.rpm', browser_download_url: 'https://example.com/x86_64.rpm', size: 9500000 },
    { name: 'rustdesk-1.4.5-unsigned.tar.gz', browser_download_url: 'https://example.com/source.tar.gz', size: 5000000 },
    { name: 'rustdesk-1.4.5.ipa', browser_download_url: 'https://example.com/rustdesk.ipa', size: 15000000 },
    { name: 'rustdesk-1.4.5-arm64.apk', browser_download_url: 'https://example.com/arm64.apk', size: 14000000 },
    { name: 'rustdesk-1.4.5-aarch64.dmg.sha256', browser_download_url: 'https://example.com/aarch64.dmg.sha256', size: 100 },
    { name: 'rustdesk-1.4.5-x86_64.exe.blockmap', browser_download_url: 'https://example.com/x86_64.exe.blockmap', size: 200 },
  ];

  var filteredAssets = DownloadLatest.filterAssets(RUSTDESK_ASSETS);

  // =====================
  // filterAssets tests
  // =====================

  test('filterAssets excludes .sha256 files', function () {
    var names = filteredAssets.map(function (a) { return a.name; });
    assert(names.indexOf('rustdesk-1.4.5-aarch64.dmg.sha256') === -1, 'should exclude .sha256');
  });

  test('filterAssets excludes .blockmap files', function () {
    var names = filteredAssets.map(function (a) { return a.name; });
    assert(names.indexOf('rustdesk-1.4.5-x86_64.exe.blockmap') === -1, 'should exclude .blockmap');
  });

  test('filterAssets keeps valid assets', function () {
    assert(filteredAssets.length === 13, 'expected 13 assets after filtering, got ' + filteredAssets.length);
  });

  // =====================
  // matchAsset tests
  // =====================

  test('macOS arm64 → aarch64.dmg', function () {
    var result = DownloadLatest.matchAsset(filteredAssets, 'macos', 'arm64', null);
    assertEqual(result.name, 'rustdesk-1.4.5-aarch64.dmg');
  });

  test('macOS x64 → x86_64.dmg', function () {
    var result = DownloadLatest.matchAsset(filteredAssets, 'macos', 'x64', null);
    assertEqual(result.name, 'rustdesk-1.4.5-x86_64.dmg');
  });

  test('Windows x64 → x86_64.exe', function () {
    var result = DownloadLatest.matchAsset(filteredAssets, 'windows', 'x64', null);
    assertEqual(result.name, 'rustdesk-1.4.5-x86_64.exe');
  });

  test('Linux x64 → x86_64.AppImage', function () {
    var result = DownloadLatest.matchAsset(filteredAssets, 'linux', 'x64', null);
    assertEqual(result.name, 'rustdesk-1.4.5-x86_64.AppImage');
  });

  test('Linux arm64 → aarch64.AppImage', function () {
    var result = DownloadLatest.matchAsset(filteredAssets, 'linux', 'arm64', null);
    assertEqual(result.name, 'rustdesk-1.4.5-aarch64.AppImage');
  });

  test('unknown platform → null', function () {
    var result = DownloadLatest.matchAsset(filteredAssets, 'freebsd', 'x64', null);
    assert(result === null, 'should return null for unknown OS');
  });

  test('custom match overrides default', function () {
    var custom = { 'linux-x64': /x86_64\.rpm$/i };
    var result = DownloadLatest.matchAsset(filteredAssets, 'linux', 'x64', custom);
    assertEqual(result.name, 'rustdesk-1.4.5-x86_64.rpm');
  });

  test('custom match array — first wins', function () {
    var custom = { 'linux-x64': [/\.deb$/i, /\.rpm$/i] };
    var result = DownloadLatest.matchAsset(filteredAssets, 'linux', 'x64', custom);
    assertEqual(result.name, 'rustdesk-1.4.5-x86_64.deb');
  });

  test('iOS arm64 → .ipa', function () {
    var result = DownloadLatest.matchAsset(filteredAssets, 'ios', 'arm64', null);
    assertEqual(result.name, 'rustdesk-1.4.5.ipa');
  });

  test('Android arm64 → arm64.apk', function () {
    var result = DownloadLatest.matchAsset(filteredAssets, 'android', 'arm64', null);
    assertEqual(result.name, 'rustdesk-1.4.5-arm64.apk');
  });

  test('empty assets → null', function () {
    var result = DownloadLatest.matchAsset([], 'macos', 'arm64', null);
    assert(result === null, 'should return null for empty assets');
  });

  // =====================
  // classifyAsset tests
  // =====================

  test('classifyAsset identifies .ipa as ios-arm64', function () {
    var result = DownloadLatest.classifyAsset({ name: 'app.ipa' });
    assert(result.indexOf('ios-arm64') !== -1, 'should classify .ipa as ios-arm64');
  });

  test('classifyAsset identifies .apk as android-arm64', function () {
    var result = DownloadLatest.classifyAsset({ name: 'app-arm64.apk' });
    assert(result.indexOf('android-arm64') !== -1, 'should classify .apk as android-arm64');
  });

  test('classifyAsset identifies .dmg as macOS', function () {
    var result = DownloadLatest.classifyAsset({ name: 'app-aarch64.dmg' });
    assert(result.indexOf('macos-arm64') !== -1, 'should classify aarch64.dmg as macos-arm64');
  });

  // =====================
  // Pattern mode tests
  // =====================

  test('pattern config matches specific file', async function () {
    var dl = new DownloadLatest({ repo: 'rustdesk/rustdesk', pattern: '\\.ipa$' });
    var result = await dl.get();
    if (result.allAssets.length > 0) {
      // Check if any .ipa exists; if so, it should match
      var hasIpa = result.allAssets.some(function (a) { return /\.ipa$/i.test(a.name); });
      if (hasIpa) {
        assert(result.matched, 'should match .ipa file');
        assert(/\.ipa$/i.test(result.asset), 'matched asset should be .ipa');
      }
    }
  });

  test('pattern mode defaults text to Download', function () {
    var dl = new DownloadLatest({ repo: 'a/b', pattern: '\\.ipa$' });
    assertEqual(dl.text, 'Download');
  });

  test('pattern mode uses custom text when provided', function () {
    var dl = new DownloadLatest({ repo: 'a/b', pattern: '\\.ipa$', text: 'Get iOS app' });
    assertEqual(dl.text, 'Get iOS app');
  });

  // =====================
  // detectPlatform tests
  // =====================

  // We can only test the current platform, but verify shape
  test('detectPlatform returns os and arch', function () {
    var p = DownloadLatest.detectPlatform();
    assert(p.hasOwnProperty('os'), 'should have os');
    assert(p.hasOwnProperty('arch'), 'should have arch');
    assert(typeof p.os === 'string' || p.os === null, 'os should be string or null');
    assert(typeof p.arch === 'string' || p.arch === null, 'arch should be string or null');
  });

  test('detectPlatform os is one of known values', function () {
    var p = DownloadLatest.detectPlatform();
    var valid = ['macos', 'windows', 'linux', 'ios', 'android', null];
    assert(valid.indexOf(p.os) !== -1, 'os "' + p.os + '" not in known values');
  });

  test('detectPlatform arch is one of known values', function () {
    var p = DownloadLatest.detectPlatform();
    var valid = ['arm64', 'x64', null];
    assert(valid.indexOf(p.arch) !== -1, 'arch "' + p.arch + '" not in known values');
  });

  // =====================
  // DownloadLatest constructor tests
  // =====================

  test('constructor accepts string shorthand', function () {
    var dl = new DownloadLatest('owner/repo');
    assertEqual(dl.repo, 'owner/repo');
  });

  test('constructor accepts config object', function () {
    var dl = new DownloadLatest({ repo: 'a/b', version: '2.0' });
    assertEqual(dl.repo, 'a/b');
    assertEqual(dl.version, '2.0');
  });

  test('releases URL is correct for latest', function () {
    var dl = new DownloadLatest('a/b');
    assertEqual(dl._releasesUrl, 'https://github.com/a/b/releases/latest');
  });

  test('releases URL is correct for pinned version', function () {
    var dl = new DownloadLatest({ repo: 'a/b', version: 'v3.0' });
    assertEqual(dl._releasesUrl, 'https://github.com/a/b/releases/tag/v3.0');
  });

  // =====================
  // noMatchText / noMatchUrl config tests
  // =====================

  test('constructor defaults noMatchText', function () {
    var dl = new DownloadLatest('a/b');
    assertEqual(dl.noMatchText, 'View all downloads');
  });

  test('constructor accepts noMatchText', function () {
    var dl = new DownloadLatest({ repo: 'a/b', noMatchText: 'Not available' });
    assertEqual(dl.noMatchText, 'Not available');
  });

  test('constructor accepts noMatchUrl', function () {
    var dl = new DownloadLatest({ repo: 'a/b', noMatchUrl: 'https://example.com/waitlist' });
    assertEqual(dl.noMatchUrl, 'https://example.com/waitlist');
  });

  test('constructor defaults noMatchUrl to null', function () {
    var dl = new DownloadLatest('a/b');
    assert(dl.noMatchUrl === null, 'should default to null');
  });

  test('constructor defaults contextMenu to false', function () {
    var dl = new DownloadLatest('a/b');
    assert(dl.contextMenu === false, 'should default to false');
  });

  test('constructor accepts contextMenu: true', function () {
    var dl = new DownloadLatest({ repo: 'a/b', contextMenu: true });
    assert(dl.contextMenu === true, 'should be true when set');
  });

  // =====================
  // Integration test (live API)
  // =====================

  test('get() returns result from live API', async function () {
    var dl = new DownloadLatest('rustdesk/rustdesk');
    var result = await dl.get();
    assert(result.version, 'should have version');
    assert(result.allAssets.length > 0, 'should have assets');
    assert(result.releasesUrl.indexOf('github.com') !== -1, 'should have releases URL');
    // On macOS/Windows/Linux this should match; on other platforms it may not
    if (result.matched) {
      assert(result.url.indexOf('github.com') !== -1, 'matched URL should be from GitHub');
      assert(result.asset, 'should have asset name when matched');
    }
  });

  // =====================
  // Run tests
  // =====================

  async function run() {
    var output = document.getElementById('output');
    function log(text, cls) {
      var div = document.createElement('div');
      div.className = cls || '';
      div.textContent = text;
      output.appendChild(div);
    }

    for (var i = 0; i < tests.length; i++) {
      var t = tests[i];
      try {
        await t.fn();
        results.passed++;
        log('✓ ' + t.name, 'pass');
      } catch (e) {
        results.failed++;
        results.errors.push(t.name + ': ' + e.message);
        log('✗ ' + t.name + ' — ' + e.message, 'fail');
      }
    }

    log('');
    var summary = results.passed + ' passed, ' + results.failed + ' failed';
    log(summary, results.failed ? 'fail' : 'pass');
    document.title = (results.failed ? '✗' : '✓') + ' ' + summary + ' – download-latest tests';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
