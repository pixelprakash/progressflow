/**
 * Design tokens. Large tap targets — teachers rate one-handed, mid-class,
 * on low-end phones. Keep contrast high and controls big.
 */
export const theme = {
  color: {
    bg: '#FFFFFF',
    surface: '#F4F5F7',
    text: '#1A1A1A',
    textMuted: '#5B5B5B',
    primary: '#2E5AAC',
    success: '#2E7D32',
    warning: '#B26A00',
    danger: '#C62828',
    border: '#DADCE0',
    primarySoft: '#E6EDF9',
    successBg: '#E6F4E7',
    warningBg: '#FFF4E0',
    dangerBg: '#FDECEA',
    scrim: '#111111',
  },
  space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radius: { sm: 8, md: 12, lg: 20 },
  tapTarget: 56, // minimum height/width for interactive controls (px)
  font: {
    body: 16,
    title: 22,
    display: 28,
  },
} as const;

export type Theme = typeof theme;
