// Keycap syntax shared by the Markdown plugin, PageTitle and the homepage.
//
// Authors keep the MkDocs `pymdownx.keys` syntax: `++ctrl+g++`, `++shift+r++`,
// `++escape++`, `++slash++`. This module parses one `++...++` spec into key
// labels that follow the app's own names (Ctrl, Shift, Alt, Enter, Esc, F2),
// normalizes modifier-first order, and renders a chord as
// `<kbd>Ctrl</kbd><span class="plus">+</span><kbd>G</kbd>`.
//
// Case rules: a single letter on its own keeps the case it was written in, so
// `++r++` is `r`, as in the app. A letter in a chord with a modifier is shown
// as a capital (`Ctrl + G`, `Shift + R`), the way keyboards label it. Shift is
// always shown explicitly; `++R++` is never rewritten as `Shift + r`.

/** Matches one keycap spec. Keys are letters, digits, dashes and underscores. */
export const KEY_PATTERN = /\+\+([A-Za-z0-9_-]+(?:\+[A-Za-z0-9_-]+)*)\+\+/g;

const MODIFIERS = ['ctrl', 'alt', 'shift', 'meta', 'cmd'];

const NAMES = {
  ctrl: 'Ctrl',
  control: 'Ctrl',
  alt: 'Alt',
  option: 'Alt',
  shift: 'Shift',
  meta: 'Meta',
  cmd: 'Cmd',
  command: 'Cmd',
  super: 'Super',
  enter: 'Enter',
  return: 'Enter',
  escape: 'Esc',
  esc: 'Esc',
  tab: 'Tab',
  space: 'Space',
  backspace: 'Backspace',
  delete: 'Delete',
  del: 'Delete',
  insert: 'Insert',
  home: 'Home',
  end: 'End',
  'page-up': 'PgUp',
  pageup: 'PgUp',
  'page-down': 'PgDn',
  pagedown: 'PgDn',
  up: '↑',
  'arrow-up': '↑',
  down: '↓',
  'arrow-down': '↓',
  left: '←',
  'arrow-left': '←',
  right: '→',
  'arrow-right': '→',
  slash: '/',
  backslash: '\\',
  question: '?',
  'open-bracket': '[',
  'close-bracket': ']',
  'left-bracket': '[',
  'right-bracket': ']',
  'open-brace': '{',
  'close-brace': '}',
  period: '.',
  comma: ',',
  colon: ':',
  semicolon: ';',
  minus: '-',
  hyphen: '-',
  plus: '+',
  equal: '=',
  quote: "'",
  'double-quote': '"',
  backtick: '`',
  tilde: '~',
  exclam: '!',
  at: '@',
  hash: '#',
  dollar: '$',
  percent: '%',
  caret: '^',
  ampersand: '&',
  asterisk: '*',
  underscore: '_',
  pipe: '|',
  less: '<',
  greater: '>',
};

/** Human label for one key token, given whether a modifier precedes it. */
function label(token, inChord) {
  const lower = token.toLowerCase();
  if (lower in NAMES) return NAMES[lower];
  if (/^f\d{1,2}$/.test(lower)) return lower.toUpperCase();
  if (token.length === 1) return inChord ? token.toUpperCase() : token;
  return token.charAt(0).toUpperCase() + token.slice(1);
}

/**
 * Parse the inside of `++...++` into labels, modifiers first.
 * `r+shift` and `shift+r` both give `['Shift', 'R']`.
 */
export function parseKeys(spec) {
  const tokens = spec.split('+').filter(Boolean);
  const mods = [];
  const rest = [];
  for (const t of tokens) {
    const lower = t.toLowerCase();
    if (MODIFIERS.includes(lower) || lower === 'control' || lower === 'command') mods.push(lower);
    else rest.push(t);
  }
  // A lone modifier (`++ctrl++`) is a key of its own.
  if (rest.length === 0) return mods.map((m) => label(m, false));
  const order = (m) => MODIFIERS.indexOf(m === 'control' ? 'ctrl' : m === 'command' ? 'cmd' : m);
  mods.sort((a, b) => order(a) - order(b));
  const inChord = mods.length > 0;
  return [...mods.map((m) => label(m, true)), ...rest.map((t) => label(t, inChord))];
}

/** Normalized authoring form, modifier first: `r+shift` becomes `shift+r`. */
export function normalizeSpec(spec) {
  const tokens = spec.split('+').filter(Boolean);
  const mods = tokens.filter((t) => MODIFIERS.includes(t.toLowerCase()));
  const rest = tokens.filter((t) => !MODIFIERS.includes(t.toLowerCase()));
  mods.sort((a, b) => MODIFIERS.indexOf(a.toLowerCase()) - MODIFIERS.indexOf(b.toLowerCase()));
  return [...mods, ...rest].join('+');
}

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** HTML for one spec: a lone `<kbd>`, or a `.chord` span for combinations. */
export function keysToHtml(spec) {
  const labels = parseKeys(spec);
  const kbds = labels.map((l) => `<kbd>${escapeHtml(l)}</kbd>`);
  if (kbds.length === 1) return kbds[0];
  return `<span class="chord">${kbds.join('<span class="plus" aria-hidden="true">+</span>')}</span>`;
}

/** Replace every `++spec++` in a plain string with keycap HTML; escape the rest. */
export function renderKeyText(text) {
  let out = '';
  let last = 0;
  for (const m of text.matchAll(KEY_PATTERN)) {
    out += escapeHtml(text.slice(last, m.index)) + keysToHtml(m[1]);
    last = m.index + m[0].length;
  }
  return out + escapeHtml(text.slice(last));
}

/** mdast nodes for one spec. `data.hName` makes them `<kbd>` and `<span>` in HTML. */
export function keysToMdast(spec) {
  const kbd = (value) => ({
    type: 'emphasis',
    data: { hName: 'kbd', hProperties: {} },
    children: [{ type: 'text', value }],
  });
  const labels = parseKeys(spec);
  if (labels.length === 1) return kbd(labels[0]);
  const children = [];
  labels.forEach((l, i) => {
    if (i > 0) {
      children.push({
        type: 'emphasis',
        data: { hName: 'span', hProperties: { className: ['plus'], ariaHidden: 'true' } },
        children: [{ type: 'text', value: '+' }],
      });
    }
    children.push(kbd(l));
  });
  return {
    type: 'emphasis',
    data: { hName: 'span', hProperties: { className: ['chord'] } },
    children,
  };
}
