// Expressive Code: one theme for both color schemes. Code stays a dark object
// on #272822 in light mode too, so it matches the product captures. The theme
// is Monokai with lifts for the token colors that miss 7:1 (WCAG AAA) on
// #272822, plus the orange lift. Captures keep true Monokai.
import { defineEcConfig, ExpressiveCodeTheme } from '@astrojs/starlight/expressive-code';
import monokai from '@shikijs/themes/monokai';

const LIFTS = {
  '#f92672': '#FC93B9', // keyword, 3.93 -> 7.09
  '#ae81ff': '#C4A3FF', // number and constant, 5.23 -> 7.10
  '#75715e': '#B6B3A4', // meta.diff and markdown quote, 3.03 -> 7.06
  '#88846f': '#B6B3A4', // comment, shiki monokai, 4.34 -> 7.06
  '#fd971f': '#FD9C29', // orange, 6.81 -> 7.05
};

const lift = (color) => {
  if (typeof color !== 'string') return color;
  const base = color.slice(0, 7).toLowerCase();
  return base in LIFTS ? LIFTS[base] + color.slice(7) : color;
};

const tokenColors = monokai.tokenColors.map((rule) => ({
  ...rule,
  settings: { ...rule.settings, foreground: lift(rule.settings?.foreground) },
}));

const theme = new ExpressiveCodeTheme({ ...monokai, name: 'tongs-monokai-aaa', type: 'dark', tokenColors });

export default defineEcConfig({
  themes: [theme],
  useStarlightDarkModeSwitch: false,
  useStarlightUiThemeColors: false,
  styleOverrides: {
    borderRadius: '6px',
    borderColor: '#3C4858',
    borderWidth: '1px',
    codeBackground: '#272822',
    codeFontFamily: 'var(--font-mono)',
    codeFontSize: '0.875rem',
    codeLineHeight: '1.7',
    codePaddingBlock: '0.875rem',
    codePaddingInline: '1.125rem',
    uiFontFamily: 'var(--font-mono)',
    uiFontSize: '0.75rem',
    focusBorder: '#ABE5F7',
    scrollbarThumbColor: 'rgba(138, 150, 168, 0.35)',
    scrollbarThumbHoverColor: 'rgba(138, 150, 168, 0.6)',
    frames: {
      shadowColor: 'transparent',
      frameBoxShadowCssValue: 'none',
      editorBackground: '#272822',
      editorTabBarBackground: '#1F201B',
      editorTabBarBorderBottomColor: '#3C4858',
      editorActiveTabBackground: '#1F201B',
      editorActiveTabForeground: '#F8F8F2',
      editorActiveTabIndicatorTopColor: 'transparent',
      editorActiveTabIndicatorBottomColor: 'transparent',
      editorActiveTabBorderColor: 'transparent',
      terminalBackground: '#272822',
      terminalTitlebarBackground: '#1F201B',
      terminalTitlebarForeground: '#B6B3A4',
      terminalTitlebarBorderBottomColor: '#3C4858',
      terminalTitlebarDotsForeground: '#56677E',
      terminalTitlebarDotsOpacity: '1',
      inlineButtonForeground: '#B6B3A4',
      inlineButtonBorder: '#3C4858',
      inlineButtonBorderOpacity: '1',
      inlineButtonBackground: '#1F201B',
      inlineButtonBackgroundIdleOpacity: '0',
      inlineButtonBackgroundHoverOrFocusOpacity: '1',
      // Quiet like the inline button: the hero CTA is the only orange-hot fill.
      tooltipSuccessBackground: '#1F201B',
      tooltipSuccessForeground: '#B6B3A4',
    },
  },
});
