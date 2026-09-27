// Theme preference: auto, dark or light, stored like Starlight's ThemeSelect.
// The choice is held in `current` as well as in storage, so the button still
// cycles through all three states when storage is blocked (the choice then
// lasts for this page only).
type Pref = 'auto' | 'dark' | 'light';
const KEY = 'starlight-theme';
const root = document.documentElement;

function stored(): Pref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'dark' || v === 'light' ? v : 'auto';
  } catch {
    return 'auto';
  }
}
const system = (): 'dark' | 'light' =>
  matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';

let current: Pref | null = null;
const pref = (): Pref => current ?? (current = stored());

function sync(): void {
  const p = pref();
  document.querySelectorAll<HTMLButtonElement>('.theme-btn').forEach((b) => {
    b.dataset.pref = p;
    b.setAttribute('aria-label', `Theme: ${p}. Switch theme`);
  });
}

function apply(next: Pref): void {
  current = next;
  root.dataset.theme = next === 'auto' ? system() : next;
  try {
    localStorage.setItem(KEY, next === 'auto' ? '' : next);
  } catch {
    /* storage blocked: the choice lasts for this page only */
  }
  sync();
}

let wired = false;
export function initThemeButtons(): void {
  sync();
  if (wired) return;
  wired = true;
  // Recover if a head script could not apply the theme.
  const p = pref();
  root.dataset.theme = p === 'auto' ? system() : p;
  const order: Pref[] = ['auto', 'dark', 'light'];
  document.addEventListener('click', (e) => {
    const btn = (e.target as Element | null)?.closest?.('.theme-btn');
    if (!btn) return;
    apply(order[(order.indexOf(pref()) + 1) % order.length]);
  });
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (pref() === 'auto') root.dataset.theme = system();
  });
}
