(function () {
  if (window.top !== window.self) return;
  const TARGET = '__SVE_TARGET__';
  const originals = new Map();
  let generation = 0;
  let translating = false;
  let controller;
  let translateButton;

  function guessSource(text) {
    if (/[\u3040-\u30ff]/.test(text)) return 'ja';
    if (/[\uac00-\ud7af]/.test(text)) return 'ko';
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh-CN';
    return 'en';
  }

  function chunks(text) {
    const encoder = new TextEncoder();
    const result = [];
    let part = '', bytes = 0;
    for (const character of text) {
      const length = encoder.encode(character).length;
      if (bytes + length > 450 && part) { result.push(part); part = ''; bytes = 0; }
      part += character; bytes += length;
    }
    if (part) result.push(part);
    return result;
  }

  function restorePage() {
    generation++;
    controller?.abort();
    translating = false;
    originals.forEach((value, node) => { if (node.isConnected) node.nodeValue = value; });
    originals.clear();
    translateButton.textContent = 'A/文';
    translateButton.title = 'Translate page';
  }

  async function translatePage() {
    if (translating) return;
    const current = ++generation;
    translating = true;
    translateButton.textContent = '…';
    translateButton.title = 'Cancel translation / restore original';
    const nodes = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest('script,style,noscript,textarea,code,pre,canvas,svg,[data-sve],[contenteditable]')) return NodeFilter.FILTER_REJECT;
        const text = node.nodeValue.trim();
        return text.length >= 2 && /[A-Za-z\u3040-\u30ff\uac00-\ud7af\u4e00-\u9fff]/.test(text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    while (walker.nextNode()) nodes.push(walker.currentNode);
    let done = 0, failed = 0;
    for (const node of nodes) {
      if (current !== generation) return;
      const original = node.nodeValue;
      const text = original.trim();
      const from = guessSource(text);
      if (!node.isConnected || from === TARGET) continue;
      try {
        const translated = [];
        for (const chunk of chunks(text)) {
          if (current !== generation) return;
          controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 12000);
          try {
            const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(chunk) + '&langpair=' + encodeURIComponent(from + '|' + TARGET);
            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) throw new Error('Translation request failed');
            const data = await response.json();
            const output = data.responseData?.translatedText;
            if ((data.responseStatus != null && Number(data.responseStatus) !== 200) || typeof output !== 'string' || !output || /MYMEMORY WARNING|QUERY LENGTH LIMIT|^INVALID/i.test(output)) throw new Error('Translation unavailable');
            translated.push(output);
          } finally { clearTimeout(timer); }
          await new Promise((resolve) => setTimeout(resolve, 220));
        }
        if (current !== generation) return;
        if (node.isConnected && node.nodeValue === original) {
          originals.set(node, original);
          node.nodeValue = original.replace(text, () => translated.join(' '));
          translateButton.textContent = '文 ' + ++done;
        }
      } catch (error) {
        if (current !== generation) return;
        failed++;
      }
    }
    if (current === generation) {
      translating = false;
      translateButton.textContent = failed ? '文 !' : 'A/文';
      translateButton.title = failed ? 'Some text could not be translated. Click to restore / retry.' : 'Restore original';
    }
  }

  async function copyUrl(button) {
    try {
      await navigator.clipboard.writeText(location.href);
    } catch {
      const area = document.createElement('textarea');
      area.value = location.href;
      area.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand('copy');
      area.remove();
      if (!copied) { button.title = 'Copy failed — select the address in your browser'; return; }
    }
    button.textContent = '✓';
    setTimeout(() => { button.textContent = 'URL'; }, 1200);
  }

  function install() {
    if (!document.body || document.getElementById('sve-toolbar')) return;
    const bar = document.createElement('div');
    bar.id = 'sve-toolbar';
    bar.setAttribute('data-sve', 'toolbar');
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'STEM Visual Explorer browser controls');
    bar.style.cssText = 'position:fixed;top:10px;right:10px;z-index:2147483647;display:flex;gap:2px;background:rgba(18,20,25,.9);border:1px solid #555;border-radius:8px;padding:3px;font:12px/1 system-ui;color:#e5e7eb;box-shadow:0 4px 16px #0005';
    function add(label, title, action) {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = label; button.title = title;
      button.setAttribute('aria-label', title);
      button.style.cssText = 'background:transparent;border:0;color:#e5e7eb;cursor:pointer;padding:5px 8px;border-radius:6px;font:12px/1 system-ui';
      button.onclick = (event) => { event.preventDefault(); event.stopPropagation(); Promise.resolve(action(button)).catch(() => { button.title = 'Action failed. Please retry.'; }); };
      bar.appendChild(button);
      return button;
    }
    add('←', 'Back', () => history.back());
    add('→', 'Forward', () => history.forward());
    add('↻', 'Reload', () => location.reload());
    add('URL', 'Copy URL', copyUrl);
    translateButton = add('A/文', 'Translate page', () => translating || originals.size ? restorePage() : translatePage());
    translateButton.id = 'sve-translate';
    add('↗', 'Open externally', () => { location.href = 'sve://open-external?url=' + encodeURIComponent(location.href); });
    add('◈', 'Pin / unpin window', () => { location.href = 'sve://toggle-pin'; });
    add('×', 'Close window', () => { location.href = 'sve://close'; });
    document.body.appendChild(bar);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
