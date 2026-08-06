# Tinkerbench 🛠️

A practice bench for students learning **HTML, CSS and JavaScript**.
No accounts, no build step, no server — just static files you can host on GitHub Pages.

## What students get

- **Three editors** (HTML / CSS / JS tabs) with syntax highlighting, auto-closing tags & brackets, and line numbers.
- **Live preview** that re-renders as they type (250 ms after the last keystroke).
- **Pop-out preview tab** — the "open preview tab" button opens the page full-size in its own browser tab, and it keeps updating in real time while they type in the editor tab.
- **Built-in console** — `console.log()` output and JavaScript errors (with line numbers) appear in a drawer under the preview, so beginners don't need DevTools on day one.
- **Autosave** — work is saved in the browser (`localStorage`) on every keystroke, plus a flush when the tab is closed or hidden. Accidentally closing the tab (or the whole browser) loses nothing: reopening the page restores the code.
- **Download menu** — two export options: a **zip** with three separate, properly linked files (`index.html`, `style.css`, `script.js` inside a `my-website/` folder), or a **single .html** file with the CSS and JS inlined — easy to share or email. `Ctrl/⌘+S` downloads the zip.
- **Reset** — restores the starter exercise.

Keyboard: `Alt+1/2/3` switches editors, `Ctrl/⌘+S` downloads the zip.

## Hosting it on GitHub Pages

1. Create a new repository on GitHub (e.g. `tinkerbench`).
2. Push the contents of this folder to it:

   ```bash
   cd tinkerbench
   git init
   git add .
   git commit -m "Add Tinkerbench playground"
   git branch -M main
   git remote add origin https://github.com/<your-username>/tinkerbench.git
   git push -u origin main
   ```

3. On GitHub: **Settings → Pages → Build and deployment** → Source: *Deploy from a branch* → Branch: `main`, folder `/ (root)` → Save.
4. After a minute your class can use it at
   `https://<your-username>.github.io/tinkerbench/`

You can also drop this folder into an existing Pages site — it's self-contained.

## Testing locally

Browsers restrict some features on `file://` URLs, so serve it instead of double-clicking:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Notes for the classroom

- Work is saved **per browser, per device**. Two students on the same lab machine and browser profile share the same saved state — the *Download .zip* button is the way to take work home.
- The pop-out preview syncs via `BroadcastChannel`/`localStorage`, which works between tabs of the **same browser**. It won't sync across different machines (nothing is uploaded anywhere).
- The preview runs in a sandboxed iframe: `alert()`, forms and scripts work; access to the hosting page does not.
- Syntax highlighting is loaded from the cdnjs CDN, and fonts from Google Fonts — the classroom needs internet access.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The editor: tabs, preview pane, console, toolbar |
| `preview.html` | The pop-out live preview tab |
| `builder.js` | Shared logic that assembles the student's code into a page |
| `zip.js` | Dependency-free ZIP writer for the download button |
| `app.js` | Editor behaviour: CodeMirror setup, autosave, sync, console |
| `style.css` | All styling, including the editor theme |
