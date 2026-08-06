/*
 * Tinkerbench — shared document builder.
 * Used by the editor page AND the pop-out preview page so both
 * assemble the student's HTML/CSS/JS into the exact same document.
 */
window.TB = (function () {
  'use strict';

  var STORAGE_KEY = 'tinkerbench.code.v1';
  var CHANNEL = 'tinkerbench-sync';

  /*
   * Injected into the preview <head>. Wraps console.* and window errors,
   * serialises the values to plain strings, and posts them to the parent
   * page so the editor can show them in its console panel.
   */
  function consoleShim() {
    function fmt(v, depth) {
      var t = typeof v;
      if (v === null) return 'null';
      if (t === 'undefined') return 'undefined';
      if (t === 'string') return depth > 0 ? '"' + v + '"' : v;
      if (t === 'number' || t === 'boolean' || t === 'bigint') return String(v);
      if (t === 'function') return 'ƒ ' + (v.name || 'anonymous') + '()';
      if (v instanceof Error) return v.toString();
      if (v && v.nodeType === 1) {
        var attrs = v.id ? ' id="' + v.id + '"' : '';
        return '<' + v.tagName.toLowerCase() + attrs + '>…</' + v.tagName.toLowerCase() + '>';
      }
      if (Array.isArray(v)) {
        if (depth > 1) return '[…]';
        return '[' + v.map(function (x) { return fmt(x, depth + 1); }).join(', ') + ']';
      }
      if (t === 'object') {
        if (depth > 1) return '{…}';
        try {
          var keys = Object.keys(v);
          var body = keys.slice(0, 12).map(function (k) {
            return k + ': ' + fmt(v[k], depth + 1);
          }).join(', ');
          if (keys.length > 12) body += ', …';
          return '{ ' + body + ' }';
        } catch (e) { return String(v); }
      }
      return String(v);
    }
    function send(kind, text) {
      try {
        parent.postMessage({ source: 'tinkerbench-console', kind: kind, text: text }, '*');
      } catch (e) { /* no parent to talk to — that's fine */ }
    }
    ['log', 'info', 'warn', 'error'].forEach(function (k) {
      var orig = console[k];
      console[k] = function () {
        var args = [].slice.call(arguments);
        send(k === 'info' ? 'log' : k, args.map(function (a) { return fmt(a, 0); }).join(' '));
        if (orig) orig.apply(console, arguments);
      };
    });
    window.addEventListener('error', function (e) {
      var text = e.message || 'Unknown error';
      var offset = window.__tbJsLine || 0;
      if (e.lineno && e.lineno > offset) {
        text += '   (line ' + (e.lineno - offset) + ' of your JS)';
      }
      send('error', text);
    });
    window.addEventListener('unhandledrejection', function (e) {
      send('error', 'Unhandled promise rejection: ' + fmt(e.reason, 0));
    });
  }

  /*
   * code: { html, css, js }
   * opts: { shim: bool  — include the console-capture shim (editor preview only),
   *         title: str }
   */
  function buildDocument(code, opts) {
    opts = opts || {};
    var html = code.html || '';
    var css = (code.css || '').replace(/<\/style/gi, '<\\/style');
    var js = (code.js || '').replace(/<\/script/gi, '<\\/script');

    var prefix =
      '<!DOCTYPE html>\n' +
      '<html lang="en">\n' +
      '<head>\n' +
      '<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      '<title>' + (opts.title || 'My page') + '</title>\n' +
      (opts.shim ? '<script>(' + consoleShim.toString() + ')();</scr' + 'ipt>\n' : '') +
      '<style>\n' + css + '\n</style>\n' +
      '</head>\n' +
      '<body>\n' +
      html + '\n' +
      (opts.shim ? '<script>window.__tbJsLine=__TB_OFF__;</scr' + 'ipt>\n' : '') +
      '<script>\n';
    var suffix = '\n</scr' + 'ipt>\n</body>\n</html>\n';

    // Tell the shim which document line the student's JS starts on, so
    // error messages can report line numbers relative to the JS pane.
    if (opts.shim) {
      prefix = prefix.replace('__TB_OFF__', String(prefix.split('\n').length - 1));
    }
    return prefix + js + suffix;
  }

  /*
   * The index.html that goes into the downloaded zip: same page,
   * but linking style.css and script.js as separate files.
   */
  function buildZipIndex(code) {
    return '<!DOCTYPE html>\n' +
      '<html lang="en">\n' +
      '<head>\n' +
      '<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      '<title>My page</title>\n' +
      '<link rel="stylesheet" href="style.css">\n' +
      '</head>\n' +
      '<body>\n' +
      (code.html || '') + '\n' +
      '<script src="script.js"></scr' + 'ipt>\n' +
      '</body>\n' +
      '</html>\n';
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    CHANNEL: CHANNEL,
    buildDocument: buildDocument,
    buildZipIndex: buildZipIndex
  };
})();
