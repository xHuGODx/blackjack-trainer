import type { CSSProperties } from 'react';
const paths = {
  cards: 'M8 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm-5 3v13a4 4 0 0 0 4 4m6-15-3 4 3 4 3-4-3-4Z',
  chart: 'M4 3v18h17M8 16v-4m5 4V8m5 8V5',
  settings: 'M4 7h16M4 17h16M8 4v6m8 4v6',
  undo: 'M9 5 4 10l5 5M4 10h10a6 6 0 0 1 6 6v3',
  redo: 'm15 5 5 5-5 5m5-5H10a6 6 0 0 0-6 6v3',
  reset: 'M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 13-3l2 3M4 16l2 3a8 8 0 0 0 13-3',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  close: 'm6 6 12 12M6 18 18 6',
  keyboard: 'M3 5h18v14H3V5Zm4 4h.01M11 9h.01M15 9h.01M19 9h.01M7 13h.01M11 13h.01M15 13h.01M7 16h10',
  shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6',
  info: 'M12 8h.01M12 11v6M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  chevron: 'm9 5 7 7-7 7',
} as const;
export function Icon({ name, size = 18, style }: { name: keyof typeof paths; size?: number; style?: CSSProperties }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={style}><path d={paths[name]} /></svg>;
}
