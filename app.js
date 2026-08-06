/* global CodeMirror, TB, TBZip */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   *  Starter code shown on first visit (and after a reset)
   * ------------------------------------------------------------------ */
  var DEFAULT_HTML = [
    '<!-- 👋 Welcome! Write your HTML here. -->',
    '',
    '<div class="card">',
    '  <h1>Hello, world!</h1>',
    '  <p>Change the code on the left — the preview updates as you type.</p>',
    '',
    '  <button id="magic-btn">Click me ✨</button>',
    '  <p id="counter">You clicked 0 times.</p>',
    '</div>'
  ].join('\n');

  var DEFAULT_CSS = [
    '/* 🎨 Style your page here. */',
    '',
    'body {',
    '  font-family: system-ui, sans-serif;',
    '  display: grid;',
    '  place-items: center;',
    '  min-height: 100vh;',
    '  margin: 0;',
    '  background: #eef2fb;',
    '}',
    '',
    '.card {',
    '  background: white;',
    '  padding: 2.5rem 3rem;',
    '  border-radius: 16px;',
    '  box-shadow: 0 12px 40px rgba(30, 60, 120, 0.15);',
    '  text-align: center;',
    '}',
    '',
    'h1 {',
    '  color: #2b49c8;',
    '  margin-top: 0;',
    '}',
    '',
    'button {',
    '  font-size: 1rem;',
    '  padding: 0.6rem 1.4rem;',
    '  border: none;',
    '  border-radius: 8px;',
    '  background: #2b49c8;',
    '  color: white;',
    '  cursor: pointer;',
    '}',
    '',
    'button:hover {',
    '  background: #1d3496;',
    '}'
  ].join('\n');

  var DEFAULT_JS = [
    '// ⚡ Make your page interactive here.',
    '',
    'let clicks = 0;',
    '',
    'const button = document.getElementById("magic-btn");',
    'const counter = document.getElementById("counter");',
    '',
    'button.addEventListener("click", () => {',
    '  clicks = clicks + 1;',
    '  counter.textContent = "You clicked " + clicks + " times.";',
    '  console.log("Button clicked!", clicks);',
    '});'
  ].join('\n');

  var DEFAULTS = { html: DEFAULT_HTML, css: DEFAULT_CSS, js: DEFAULT_JS };
  var SPLIT_KEY = 'tinkerbench.split';

  /* ------------------------------------------------------------------ *
   *  Elements
   * ------------------------------------------------------------------ */
  var iframe = document.getElementById('preview');
  var bench = document.getElementById('bench');
  var editorsPanel = document.getElementById('editors-panel');
  var divider = document.getElementById('divider');
  var saveState = document.getElementById('save-state');
  var consolePanel = document.getElementById('console-panel');
  var consoleList = document.getElementById('console-list');
  var consoleBody = document.getElementById('console-body');
  var consoleCount = document.getElementById('console-count');
  var consoleEmpty = document.getElementById('console-empty');

  /* ------------------------------------------------------------------ *
   *  Load saved work (or the starter project)
   * ------------------------------------------------------------------ */
  function loadSaved() {
    try {
      var raw = localStorage.getItem(TB.STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (typeof data.html !== 'string') return null;
      return data;
    } catch (e) { return null; }
  }
  var initial = loadSaved() || DEFAULTS;

  /* ------------------------------------------------------------------ *
   *  CodeMirror editors — one per language, shown via tabs
   * ------------------------------------------------------------------ */
  var editors = {};
  var panes = [
    { id: 'html', mode: 'htmlmixed' },
    { id: 'css', mode: 'css' },
    { id: 'js', mode: 'javascript' }
  ];

  panes.forEach(function (pane) {
    var host = document.getElementById('host-' + pane.id);
    editors[pane.id] = CodeMirror(host, {
      value: initial[pane.id] || '',
      mode: pane.mode,
      theme: 'inkwell',
      lineNumbers: true,
      lineWrapping: true,
      styleActiveLine: true,
      autoCloseBrackets: true,
      autoCloseTags: pane.id === 'html',
      matchBrackets: true,
      indentUnit: 2,
      tabSize: 2,
      extraKeys: {
        Tab: function (cm) {
          if (cm.somethingSelected()) cm.indentSelection('add');
          else cm.replaceSelection('  ', 'end');
        },
        'Shift-Tab': function (cm) { cm.indentSelection('subtract'); }
      }
    });
    editors[pane.id].on('change', scheduleUpdate);
  });

  /* ------------------------------------------------------------------ *
   *  Tabs
   * ------------------------------------------------------------------ */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));

  function activate(id) {
    tabs.forEach(function (t) {
      var on = t.dataset.pane === id;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    panes.forEach(function (p) {
      document.getElementById('host-' + p.id).classList.toggle('active', p.id === id);
    });
    editors[id].refresh();
    editors[id].focus();
  }

  tabs.forEach(function (t) {
    t.addEventListener('click', function () { activate(t.dataset.pane); });
  });

  document.addEventListener('keydown', function (e) {
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      var map = { Digit1: 'html', Digit2: 'css', Digit3: 'js' };
      if (map[e.code]) { e.preventDefault(); activate(map[e.code]); }
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      downloadZip();
    }
  });

  /* ------------------------------------------------------------------ *
   *  Live preview + cross-tab sync
   * ------------------------------------------------------------------ */
  var channel = 'BroadcastChannel' in window ? new BroadcastChannel(TB.CHANNEL) : null;
  var updateTimer = null;

  function currentCode() {
    return {
      html: editors.html.getValue(),
      css: editors.css.getValue(),
      js: editors.js.getValue(),
      t: Date.now()
    };
  }

  function persist(code) {
    try { localStorage.setItem(TB.STORAGE_KEY, JSON.stringify(code)); } catch (e) { /* storage full/blocked */ }
  }

  function render(code) {
    clearConsole();
    iframe.srcdoc = TB.buildDocument(code, { shim: true, title: 'Tinkerbench preview' });
  }

  function scheduleUpdate() {
    saveState.textContent = '● saving…';
    saveState.classList.add('busy');
    // Persist on every keystroke, not just after the debounce — closing
    // the tab at any moment must never lose work.
    persist(currentCode());
    clearTimeout(updateTimer);
    updateTimer = setTimeout(function () {
      var code = currentCode();
      persist(code);
      if (channel) channel.postMessage(code);
      render(code);
      flashSaved();
    }, 250);
  }

  // Belt and braces: flush the latest code when the tab is closed,
  // reloaded, or backgrounded.
  window.addEventListener('pagehide', function () { persist(currentCode()); });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') persist(currentCode());
  });

  function flashSaved() {
    saveState.textContent = '● saved';
    saveState.classList.remove('busy');
  }

  /* ------------------------------------------------------------------ *
   *  Console panel — receives messages posted by the preview shim
   * ------------------------------------------------------------------ */
  var entryCount = 0;

  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.source !== 'tinkerbench-console') return;
    var li = document.createElement('li');
    li.className = 'console-entry is-' + d.kind;
    li.textContent = d.text;
    consoleList.appendChild(li);
    entryCount++;
    consoleCount.textContent = entryCount;
    consoleCount.hidden = false;
    consoleEmpty.hidden = true;
    if (d.kind === 'error') consolePanel.classList.add('open');
    consoleBody.scrollTop = consoleBody.scrollHeight;
  });

  function clearConsole() {
    consoleList.innerHTML = '';
    entryCount = 0;
    consoleCount.hidden = true;
    consoleEmpty.hidden = false;
  }

  document.getElementById('console-toggle').addEventListener('click', function () {
    consolePanel.classList.toggle('open');
  });
  document.getElementById('console-clear').addEventListener('click', function (e) {
    e.stopPropagation();
    clearConsole();
  });

  /* ------------------------------------------------------------------ *
   *  Toolbar actions
   * ------------------------------------------------------------------ */
  document.getElementById('btn-popout').addEventListener('click', openPopout);
  document.getElementById('btn-popout-mini').addEventListener('click', openPopout);

  function openPopout() {
    persist(currentCode());
    window.open('preview.html', 'tinkerbench-preview');
  }

  var dlButton = document.getElementById('btn-download');
  var dlMenu = document.getElementById('dl-menu');
  var downloadFlashTimer = null;

  function setMenu(open) {
    dlMenu.hidden = !open;
    dlButton.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  dlButton.addEventListener('click', function (e) {
    e.stopPropagation();
    setMenu(dlMenu.hidden);
  });
  document.addEventListener('click', function () { setMenu(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setMenu(false);
  });

  document.getElementById('btn-dl-zip').addEventListener('click', downloadZip);
  document.getElementById('btn-dl-html').addEventListener('click', downloadSingleHtml);

  function triggerDownload(blob, filename, label) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    setMenu(false);

    saveState.textContent = '● ' + label + ' downloaded';
    saveState.classList.remove('busy');
    clearTimeout(downloadFlashTimer);
    downloadFlashTimer = setTimeout(flashSaved, 2000);
  }

  function downloadZip() {
    var code = currentCode();
    persist(code);
    var blob = TBZip.build([
      { name: 'my-website/index.html', text: TB.buildZipIndex(code) },
      { name: 'my-website/style.css', text: code.css || '' },
      { name: 'my-website/script.js', text: code.js || '' }
    ]);
    triggerDownload(blob, 'my-website.zip', 'zip');
  }

  function downloadSingleHtml() {
    var code = currentCode();
    persist(code);
    var doc = TB.buildDocument(code, { shim: false, title: 'My page' });
    triggerDownload(new Blob([doc], { type: 'text/html' }), 'my-page.html', 'html');
  }

  document.getElementById('btn-reset').addEventListener('click', function () {
    var ok = window.confirm('Reset all three editors back to the starter code?\nYour current work will be lost.');
    if (!ok) return;
    editors.html.setValue(DEFAULT_HTML);
    editors.css.setValue(DEFAULT_CSS);
    editors.js.setValue(DEFAULT_JS);
    activate('html');
  });

  /* ------------------------------------------------------------------ *
   *  Draggable split between editors and preview
   * ------------------------------------------------------------------ */
  (function initSplit() {
    var stored = parseFloat(localStorage.getItem(SPLIT_KEY));
    if (stored >= 25 && stored <= 72) editorsPanel.style.flexBasis = stored + '%';

    divider.addEventListener('pointerdown', function (e) {
      if (window.innerWidth < 901) return;
      e.preventDefault();
      divider.setPointerCapture(e.pointerId);
      document.body.classList.add('dragging');

      function onMove(ev) {
        var rect = bench.getBoundingClientRect();
        var pct = ((ev.clientX - rect.left) / rect.width) * 100;
        pct = Math.max(25, Math.min(72, pct));
        editorsPanel.style.flexBasis = pct + '%';
        try { localStorage.setItem(SPLIT_KEY, pct.toFixed(1)); } catch (err) { /* ignore */ }
      }
      function onUp(ev) {
        divider.releasePointerCapture(ev.pointerId);
        document.body.classList.remove('dragging');
        divider.removeEventListener('pointermove', onMove);
        divider.removeEventListener('pointerup', onUp);
        Object.keys(editors).forEach(function (k) { editors[k].refresh(); });
      }
      divider.addEventListener('pointermove', onMove);
      divider.addEventListener('pointerup', onUp);
    });
  })();

  /* ------------------------------------------------------------------ *
   *  First render
   * ------------------------------------------------------------------ */
  activate('html');
  var first = currentCode();
  persist(first);
  render(first);
  if (channel) channel.postMessage(first);
})();
