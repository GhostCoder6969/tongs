// Homepage and 404 behavior: copy, cursor, loops, heat clamp, menu, search.
// No dependencies. Nothing is hidden before this runs, so the page
// is complete without JS, under reduced motion, and in automated captures.
const root = document.documentElement;
// Loop videos and their play/pause buttons show only under .js (tokens.css):
// without JS, browsers force native controls over the stills.
root.classList.add('js');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const io = 'IntersectionObserver' in window;

function copyButtons(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((b) => {
    b.addEventListener('click', () => {
      const src = document.getElementById(b.dataset.copy ?? '');
      const text = src ? src.innerText.replace(/^\$\s*/gm, '').trim() : '';
      const lbl = b.querySelector('.lbl');
      const live = document.getElementById('copy-status');
      // Clear, then set on a later tick, so a repeated message is announced again.
      const report = (label: string, msg: string, success: boolean) => {
        b.classList.toggle('done', success);
        if (lbl) lbl.textContent = label;
        if (live) {
          live.textContent = '';
          setTimeout(() => { live.textContent = msg; }, 50);
        }
        setTimeout(() => {
          b.classList.remove('done');
          if (lbl) lbl.textContent = 'copy';
          if (live) live.textContent = '';
        }, 1600);
      };
      const ok = () => report('copied', 'Copied to clipboard', true);
      const fail = () => report('select to copy', 'Copy failed, select the command to copy it', false);
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(ok, fail);
      else fail();
    });
  });
}

// Loops play only where the video is shown (wider than 900px, matching the
// stills query in home.css). The videos carry no poster and preload nothing;
// the <picture> still under each one is the only image a phone downloads.
const wide = matchMedia('(min-width: 901px)');

function loops(): void {
  document.querySelectorAll<HTMLVideoElement>('video[data-loop]').forEach((v) => {
    const btn = document.querySelector<HTMLButtonElement>(`[data-toggle="${v.id}"]`);
    const still = v.parentElement?.querySelector('.still');
    let userPaused = false;
    const label = () => {
      if (!btn) return;
      const word = v.paused ? 'play' : 'pause';
      btn.textContent = word;
      btn.setAttribute('aria-label', `${word} ${btn.dataset.name ?? 'loop'}`);
    };
    // Where the video shows, it carries the description; the still under it is hidden from assistive tech.
    const sync = () => still?.toggleAttribute('aria-hidden', wide.matches);
    sync();
    wide.addEventListener('change', sync);
    const play = () => v.play().then(label, label);
    btn?.addEventListener('click', () => {
      if (v.paused) {
        userPaused = false;
        play();
      } else {
        userPaused = true;
        v.pause();
        label();
      }
    });
    label();
    if (reduce || !io) return;
    new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting && !userPaused && wide.matches) play();
          else if (!e.isIntersecting && !v.paused) {
            v.pause();
            label();
          }
        }),
      { threshold: 0.4 }
    ).observe(v);
  });
}

function heat(): void {
  const band = document.getElementById('heat');
  if (!band) return;
  if (reduce || !io) return band.classList.add('closed');
  const hio = new IntersectionObserver(
    (es) => es.forEach((e) => { if (e.isIntersecting) { band.classList.add('closed'); hio.disconnect(); } }),
    { threshold: 0.6 }
  );
  hio.observe(band);
}

function closeMenu(focus = false): void {
  document.querySelectorAll<HTMLDetailsElement>('details.menu[open]').forEach((m) => {
    m.open = false;
    if (focus) m.querySelector<HTMLElement>('summary')?.focus();
  });
}

// The small-screen menu is a <details>: close it on Escape, on a click
// outside it, and when the viewport grows past the breakpoint that hides it.
function menu(): void {
  if (!document.querySelector('details.menu')) return;
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.querySelector('details.menu[open]')) closeMenu(true);
  });
  document.addEventListener('click', (e) => {
    const t = e.target as Node | null;
    document.querySelectorAll<HTMLDetailsElement>('details.menu[open]').forEach((m) => {
      if (t && !m.contains(t)) m.open = false;
    });
  });
  // home.css shows the menu at max-width 960px.
  matchMedia('(min-width: 961px)').addEventListener('change', (e) => { if (e.matches) closeMenu(); });
}

const UI_JS = '/pagefind/pagefind-ui.js';

function search(): void {
  const dlg = document.getElementById('search-dialog') as HTMLDialogElement | null;
  const box = document.getElementById('home-search');
  if (!dlg || !box) return;
  let loaded = false;
  let loading = false;
  const failed = () => {
    box.replaceChildren();
    const msg = document.createElement('div');
    msg.className = 'search-failed';
    msg.setAttribute('role', 'status');
    msg.innerHTML =
      '<p>Search could not load. Check your connection and try again.</p>' +
      '<button class="retry" type="button">Try again</button>' +
      '<p>Or start from <a href="/getting-started/">Install and sign in</a>.</p>';
    msg.querySelector('button')?.addEventListener('click', () => open());
    box.append(msg);
    msg.querySelector<HTMLButtonElement>('button')?.focus();
  };
  const open = async () => {
    closeMenu();
    if (!dlg.open) {
      dlg.showModal();
      root.style.overflow = 'hidden';
    }
    if (!loaded && !loading) {
      loading = true;
      if (!document.querySelector('link[data-pagefind-css]')) {
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = '/pagefind/pagefind-ui.css';
        css.dataset.pagefindCss = '';
        document.head.append(css);
      }
      document.querySelectorAll(`script[src="${UI_JS}"]`).forEach((s) => s.remove());
      const ok = await new Promise<boolean>((res) => {
        const s = document.createElement('script');
        s.src = UI_JS;
        s.onload = () => res(true);
        s.onerror = () => {
          s.remove();
          res(false);
        };
        document.head.append(s);
      });
      loading = false;
      const UI = (window as unknown as { PagefindUI?: new (o: object) => unknown }).PagefindUI;
      if (!ok || !UI) return failed();
      box.replaceChildren();
      try {
        new UI({ element: '#home-search', showImages: false, showSubResults: true, translations: { placeholder: 'Search docs' } });
      } catch {
        return failed();
      }
      loaded = true;
    }
    dlg.querySelector<HTMLInputElement>('input')?.focus();
  };
  // The 404 CTA is a link to the docs without JS; with JS it opens search.
  document.querySelectorAll('[data-search]').forEach((b) =>
    b.addEventListener('click', (e) => {
      e.preventDefault();
      open();
    }),
  );
  dlg.addEventListener('close', () => { root.style.overflow = ''; });
  dlg.querySelector('[data-close]')?.addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey) && !e.altKey) {
      e.preventDefault();
      open();
      return;
    }
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    const el = document.activeElement as HTMLElement | null;
    if (el && (/^(input|textarea|select)$/i.test(el.tagName) || el.isContentEditable)) return;
    e.preventDefault();
    open();
  });
}

export function initHome(): void {
  if (!reduce) root.classList.add('motion');
  if (!reduce) document.querySelectorAll('.cursor').forEach((c) => c.classList.add('blink'));
  copyButtons();
  loops();
  heat();
  menu();
  search();
}
