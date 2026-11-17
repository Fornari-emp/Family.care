import Svg, { Path } from 'react-native-svg';

/** Paths de ícones do protótipo (sem o `target` morto — item 27). */
export const ICON_PATHS = {
  shirt: 'M8 4 4 7l2 3 2-1.3V20h8V8.7L18 10l2-3-4-3-2 2h-4z',
  watch:
    'M12 7.4V12l3 1.8M9.7 6l.6-2.2h3.4l.6 2.2M9.7 18l.6 2.2h3.4l.6-2.2M16.6 12a4.6 4.6 0 1 1-9.2 0 4.6 4.6 0 0 1 9.2 0z',
  glasses:
    'M10.4 13h3.2M3.5 12.5 4.8 9h1.6M20.5 12.5 19.2 9h-1.6M10.4 13.5a3.2 3.2 0 1 1-6.4 0 3.2 3.2 0 0 1 6.4 0zM20 13.5a3.2 3.2 0 1 1-6.4 0 3.2 3.2 0 0 1 6.4 0z',
  chain: 'M12 4v4M8 8h8l-1 4H9zM10 12l2 8 2-8',
  hat: 'M5 16.5h14l-1-6h-12zM9 10.5V5.8c0-.5.5-.8 1-.6l5.6 2.3c.7.3.6 1.3-.1 1.5zM4 16.5h16v1.6a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 18.1z',
  crown: 'M4 18h16l-1.3-8.2-4 3.2L12 6l-2.7 7-4-3.2zM6 20.5h12',
  sparkle:
    'M12 3.5c.4 3 1.7 4.3 4.7 4.7-3 .4-4.3 1.7-4.7 4.7-.4-3-1.7-4.3-4.7-4.7 3-.4 4.3-1.7 4.7-4.7zM18.5 14c.2 1.5.9 2.2 2.4 2.4-1.5.2-2.2.9-2.4 2.4-.2-1.5-.9-2.2-2.4-2.4 1.5-.2 2.2-.9 2.4-2.4z',
  pig: 'M19.2 13.2a7.2 6.2 0 1 1-14.4 0 7.2 6.2 0 0 1 14.4 0zM6.2 9.2 4.3 6.6l2.9.7zM17.8 9.2l1.9-2.6-2.9.7zM14.6 14.4a2.6 1.8 0 1 1-5.2 0 2.6 1.8 0 0 1 5.2 0z',
  bull: 'M3.5 8.2q1.6-5 5.4-1.4M20.5 8.2q-1.6-5-5.4-1.4M17.6 13.5a5.6 5.6 0 1 1-11.2 0 5.6 5.6 0 0 1 11.2 0zM8 12.2q4 2.4 8 0',
  eagle:
    'M2 12.8c4.4-5.6 8.5-6.4 10-6.4s5.6.8 10 6.4c-4-2-7.2-1.7-10 1.4-2.8-3.1-6-3.4-10-1.4zM12 7.9v6.5M9 21l3-4.5 3 4.5',
  ring: 'M20.5 12a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0zM16.8 12a4.8 4.8 0 1 1-9.6 0 4.8 4.8 0 0 1 9.6 0z',
  gem: 'M4 9.5 9 4h6l5 5.5-8 10zM4 9.5h16M9 4 12 9.5 15 4M8.5 9.5 12 19.5 15.5 9.5',
  coin: 'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0zM12 7.7v8.6M14.6 9.7c0-1-1.1-1.8-2.6-1.8s-2.6.7-2.6 1.7c0 2.4 5.2 1.1 5.2 3.5 0 1-1.1 1.8-2.6 1.8s-2.6-.8-2.6-1.8',
  flame:
    'M12 2.5c1.1 2.7-.7 4-1.8 5.6-1.3 1.9-2 3.3-2 4.9a3.8 3.8 0 0 0 7.6 0c0-1.1-.3-2.1-1-3 1 .8 1.7 2.1 1.7 3.7a5.1 5.1 0 0 1-10.2 0c0-4.8 3.7-6.3 5.7-11.2z',
  star: 'M12 4.2 14.3 9.4 20 10.1 15.8 13.9 17 19.6 12 16.6 7 19.6 8.2 13.9 4 10.1 9.7 9.4z',
  chart: 'M4 20V9M10 20V5M16 20v-8M3 20h18',
  medal:
    'M17.2 9.5a5.2 5.2 0 1 1-10.4 0 5.2 5.2 0 0 1 10.4 0zM9 13.8 7.2 20.5 12 18l4.8 2.5-1.8-6.7',
  lock: 'M18.5 12.1a1.6 1.6 0 0 0-1.6-1.6H7.1a1.6 1.6 0 0 0-1.6 1.6v6.3A1.6 1.6 0 0 0 7.1 20h9.8a1.6 1.6 0 0 0 1.6-1.6zM8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5',
  home: 'M3.5 11 12 4.5 20.5 11M5.5 9.5V19a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5',
  trophy: 'M4 18h16l-1.4-8.6-4.2 3.4L12 6l-2.4 6.8-4.2-3.4z',
  bag: 'M6.5 8.5h11l1 12h-13zM9 8.5v-1a3 3 0 0 1 6 0v1',
  user: 'M12 8.3a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 0 0 0-6.6zM5.5 20c0-3.6 3-6 6.5-6s6.5 2.4 6.5 6',
  check: 'M5 12.5 10 17.5 19.5 7',
  chest:
    'M3 9.5h18v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19zM4.5 9.5 6 4.5h12l1.5 5M12 9.5v11',
  book: 'M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z',
  snow: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5',
  edit: 'M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3zM14 7l3 3',
  trash: 'M5 7h14M10 11v6M14 11v6M6.5 7l1 13h9l1-13M9.5 7V4.5h5V7',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  close: 'M6 6l12 12M18 6 6 18',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
} as const;

export type IconName = keyof typeof ICON_PATHS;

export interface IconProps {
  name: IconName;
  size?: number;
  color: string;
  fill?: string;
  strokeWidth?: number;
}

/** Ícone decorativo: o rótulo acessível fica no elemento interativo que o contém. */
export function Icon({ name, size = 20, color, fill = 'none', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path
        d={ICON_PATHS[name]}
        stroke={color}
        fill={fill}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function isIconName(name: string): name is IconName {
  return name in ICON_PATHS;
}
