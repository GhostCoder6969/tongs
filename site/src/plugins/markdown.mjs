// Markdown plugins for the Sätteri processor (Astro 7's default engine).
// Sätteri plugins are the remark (mdast) and rehype (hast) equivalents; they
// use the same AST shapes, so these work on both .md and .mdx pages.
import { KEY_PATTERN, keysToMdast } from './keys.mjs';

/**
 * Keycaps: `++ctrl+g++` in running text becomes styled `<kbd>` keycaps.
 * Inline code and code blocks are separate node types, so `` `++x++` `` stays
 * literal.
 */
export const keycapsPlugin = {
  name: 'tongs-keycaps',
  text(node, ctx) {
    const value = node.value;
    if (!value.includes('++')) return;
    const parts = [];
    let last = 0;
    for (const m of value.matchAll(KEY_PATTERN)) {
      if (m.index > last) parts.push({ type: 'text', value: value.slice(last, m.index) });
      parts.push(keysToMdast(m[1]));
      last = m.index + m[0].length;
    }
    if (parts.length === 0) return;
    if (last < value.length) parts.push({ type: 'text', value: value.slice(last) });
    ctx.replaceNode(node, parts);
  },
};

const textOf = (node) => {
  if (!node) return '';
  if (node.type === 'text') return node.value;
  return (node.children || []).map(textOf).join('');
};

const childElements = (node, tag) =>
  (node.children || []).filter((c) => c.type === 'element' && (!tag || c.tagName === tag));

/**
 * Tables: copy each column's header text into `data-label` on its cells, so
 * the CSS can stack rows into cards on phones without contributors writing HTML.
 * Inline code with no whitespace (a key, tool name, state or path) gets the
 * `ident` class, so the CSS can keep it on one line instead of splitting it.
 */
export const tableLabelsPlugin = {
  name: 'tongs-table-labels',
  element: {
    filter: ['table'],
    visit(node, ctx) {
      const thead = childElements(node, 'thead')[0];
      const headRow = thead && childElements(thead, 'tr')[0];
      if (!headRow) return;
      const labels = childElements(headRow).map((th) => textOf(th).trim());
      for (const tbody of childElements(node, 'tbody')) {
        for (const tr of childElements(tbody, 'tr')) {
          childElements(tr).forEach((td, i) => {
            if (labels[i]) ctx.setProperty(td, 'dataLabel', labels[i]);
            for (const code of childElements(td, 'code')) {
              if (!/\s/.test(textOf(code))) ctx.setProperty(code, 'className', ['ident']);
            }
          });
        }
      }
    },
  },
};
