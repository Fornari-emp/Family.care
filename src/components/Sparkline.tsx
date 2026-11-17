import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { colors } from '@/theme';

export interface SparklineProps {
  values: number[];
  label: string;
  height?: number;
  color?: string;
}

/** Monta o path de uma série real (sem pontos inventados — item 16). */
export function sparkPath(
  values: number[],
  width: number,
  height: number,
): { line: string; area: string } | null {
  if (values.length === 0) return null;
  const pts = values.length === 1 ? [values[0] as number, values[0] as number] : values;
  const max = Math.max(...pts, 1);
  const min = Math.min(...pts, 0);
  const span = max - min || 1;
  const coords = pts.map((v, i) => [
    (i / (pts.length - 1)) * (width - 4) + 2,
    height - 6 - ((v - min) / span) * (height - 16),
  ]);
  const line = coords
    .map(([x, y], i) => `${i ? 'L' : 'M'}${x!.toFixed(1)} ${y!.toFixed(1)}`)
    .join(' ');
  return { line, area: `${line} L${width - 2} ${height} L2 ${height} Z` };
}

export function Sparkline({ values, label, height = 66, color = colors.money }: SparklineProps) {
  const width = 300;
  const p = sparkPath(values, width, height);
  if (!p) return null;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ marginTop: 8 }}>
      <Svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity={0.38} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={p.area} fill="url(#spark)" />
        <Path
          d={p.line}
          fill="none"
          stroke={color}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}
