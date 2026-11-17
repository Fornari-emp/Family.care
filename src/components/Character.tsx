/**
 * "Seu investidor": personagem SVG do protótipo (terno, acessórios, aura, pet e moldura).
 * Animações respeitam "reduzir movimento" do sistema (item 23).
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';

import { ICON_PATHS } from './Icon';
import type { Equipped } from '@/domain/types';

const SUITS: Record<
  string,
  { body: string; top: string; trim: string; collar: string; tie: string }
> = {
  'suit-basic': {
    body: '#4E4638',
    top: '#5F5646',
    trim: '#6C6250',
    collar: '#39332A',
    tie: '#8A6A3A',
  },
  'suit-exec': {
    body: '#241F19',
    top: '#3A3229',
    trim: '#FFC53D',
    collar: '#17130F',
    tie: '#B23B2A',
  },
  'suit-gold': {
    body: '#E2A93C',
    top: '#FFD766',
    trim: '#FFF2CC',
    collar: '#B0822C',
    tie: '#6B4A12',
  },
  'suit-platinum': {
    body: '#BAC1CC',
    top: '#E3E8EF',
    trim: '#FFFFFF',
    collar: '#8F97A3',
    tie: '#3C4552',
  },
  'suit-diamond': {
    body: '#79CFC6',
    top: '#B9F0E9',
    trim: '#EAFFFC',
    collar: '#4E9C94',
    tie: '#1F5C56',
  },
};
const AURAS: Record<string, string> = {
  'aura-gold': '#FFC53D',
  'aura-violet': '#B78BFF',
  'aura-diamond': '#8FE3DB',
};
const FRAMES: Record<string, string> = { 'frame-gold': '#FFC53D', 'frame-diamond': '#8FE3DB' };
const PETS: Record<string, { f: string; r: string; p: string }> = {
  'pet-pig': { f: '#F09BB0', r: '#B4677C', p: ICON_PATHS.pig },
  'pet-bull': { f: '#FF7A45', r: '#B24A22', p: ICON_PATHS.bull },
  'pet-eagle': { f: '#FFC53D', r: '#B0822C', p: ICON_PATHS.eagle },
};

/** Descrição falada do visual atual (o desenho em si é decorativo). */
export function describeLoadout(eq: Equipped, names: (id: string) => string): string {
  const parts = [names(eq.suit)];
  for (const id of [eq.accessory, eq.aura, eq.pet, eq.frame]) if (id) parts.push(names(id));
  return `Seu investidor usando ${parts.join(', ')}`;
}

function useLoop(enabled: boolean, durationMs: number) {
  const v = useSharedValue(0);
  useEffect(() => {
    if (!enabled) {
      v.value = 0;
      return;
    }
    v.value = withRepeat(
      withTiming(1, { duration: durationMs / 2, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [enabled, durationMs, v]);
  return v;
}

export interface CharacterProps {
  equipped: Equipped;
  size?: number;
  /** Desliga animações (miniaturas, prévias). */
  still?: boolean;
  accessibilityLabel?: string;
}

export function Character({
  equipped,
  size = 214,
  still = false,
  accessibilityLabel,
}: CharacterProps) {
  const reduceMotion = useReducedMotion();
  const animate = !still && !reduceMotion;
  const float = useLoop(animate, 4600);
  const pulse = useLoop(animate && !!equipped.aura, 2800);

  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -7 * float.value }] }));
  const auraStyle = useAnimatedStyle(() => ({
    opacity: 0.45 + 0.5 * pulse.value,
    transform: [{ scale: 1 + 0.06 * pulse.value }],
  }));

  const suit = SUITS[equipped.suit] ?? (SUITS['suit-basic'] as (typeof SUITS)[string]);
  const auraColor = equipped.aura ? AURAS[equipped.aura] : undefined;
  const frameColor = equipped.frame ? FRAMES[equipped.frame] : undefined;
  const pet = equipped.pet ? PETS[equipped.pet] : undefined;
  const acc = equipped.accessory;
  const height = (size * 260) / 240;

  return (
    <View
      style={{ width: size, height }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? 'Seu investidor'}
    >
      {auraColor ? (
        <Animated.View style={[StyleSheet.absoluteFill, auraStyle]} pointerEvents="none">
          <Svg width={size} height={height} viewBox="0 0 240 260">
            <Circle
              cx={120}
              cy={118}
              r={104}
              fill="none"
              stroke={auraColor}
              strokeWidth={6}
              opacity={0.5}
            />
            <Circle
              cx={120}
              cy={118}
              r={116}
              fill="none"
              stroke={auraColor}
              strokeWidth={2}
              opacity={0.3}
            />
          </Svg>
        </Animated.View>
      ) : null}
      <Animated.View style={[StyleSheet.absoluteFill, floatStyle]}>
        <Svg width={size} height={height} viewBox="0 0 240 260">
          <Defs>
            <LinearGradient id="ilSuit" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={suit.top} />
              <Stop offset="100%" stopColor={suit.body} />
            </LinearGradient>
            <LinearGradient id="ilSkin" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#FCE3C2" />
              <Stop offset="100%" stopColor="#EEC79C" />
            </LinearGradient>
            <RadialGradient id="ilPlate" cx="50%" cy="35%">
              <Stop offset="0%" stopColor="#2E2418" />
              <Stop offset="100%" stopColor="#18120D" />
            </RadialGradient>
          </Defs>
          <Circle
            cx={120}
            cy={118}
            r={96}
            fill="url(#ilPlate)"
            stroke="#3A2C1D"
            strokeWidth={1.5}
          />
          <Ellipse cx={120} cy={212} rx={72} ry={12} fill="#0C0907" opacity={0.55} />
          {frameColor ? (
            <G>
              <Circle
                cx={120}
                cy={118}
                r={92}
                fill="none"
                stroke={frameColor}
                strokeWidth={2.5}
                opacity={0.9}
              />
              {Array.from({ length: 20 }, (_, i) => {
                const a = (i / 20) * 2 * Math.PI;
                return (
                  <Circle
                    key={i}
                    cx={120 + Math.cos(a) * 98}
                    cy={118 + Math.sin(a) * 98}
                    r={3}
                    fill={frameColor}
                  />
                );
              })}
            </G>
          ) : null}
          <Path d="M56 232 C58 182 82 158 120 158 C158 158 182 182 184 232 Z" fill="url(#ilSuit)" />
          <Path d="M120 158 L100 178 L110 172 L120 190 L130 172 L140 178 Z" fill={suit.collar} />
          <Path
            d="M120 158 L104 180 L92 232"
            stroke={suit.trim}
            strokeWidth={2.6}
            fill="none"
            strokeLinecap="round"
            opacity={0.9}
          />
          <Path
            d="M120 158 L136 180 L148 232"
            stroke={suit.trim}
            strokeWidth={2.6}
            fill="none"
            strokeLinecap="round"
            opacity={0.9}
          />
          <Path d="M113 174 L127 174 L124 206 L120 212 L116 206 Z" fill={suit.tie} />
          <Path
            d="M56 232 C58 200 68 182 82 172"
            stroke="rgba(255,255,255,.09)"
            strokeWidth={5}
            fill="none"
            strokeLinecap="round"
          />
          {acc === 'acc-chain' ? (
            <Path
              d="M96 168 q24 26 48 0"
              stroke="#FFC53D"
              strokeWidth={3.4}
              fill="none"
              strokeLinecap="round"
              strokeDasharray="1 7"
            />
          ) : null}
          {acc === 'acc-watch' ? (
            <G>
              <Path
                d="M104 176 q-14 12 -12 26"
                stroke="#E7C77A"
                strokeWidth={2.6}
                fill="none"
                strokeLinecap="round"
              />
              <Circle cx={92} cy={208} r={15} fill="#12100C" stroke="#FFD766" strokeWidth={3} />
              <Circle cx={92} cy={208} r={10.5} fill="#FFF6DC" />
              <Path
                d="M92 200.5V208l5.5 3.4"
                stroke="#2A1A05"
                strokeWidth={2.2}
                fill="none"
                strokeLinecap="round"
              />
              <Circle cx={92} cy={208} r={1.6} fill="#2A1A05" />
            </G>
          ) : null}
          <Path d="M110 138 h20 v18 q-10 8 -20 0 z" fill="#E0B98E" />
          <Ellipse cx={120} cy={106} rx={31} ry={34} fill="url(#ilSkin)" />
          <Ellipse cx={89} cy={110} rx={5} ry={7} fill="#EEC79C" />
          <Ellipse cx={151} cy={110} rx={5} ry={7} fill="#EEC79C" />
          <Path
            d="M92 92 q4 -26 28 -26 q24 0 28 26 q-10 -12 -28 -12 q-18 0 -28 12 z"
            fill="#3A2A1C"
          />
          <Path
            d="M104 96 q7 -4 13 0"
            stroke="#3A2A1C"
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d="M123 96 q7 -4 13 0"
            stroke="#3A2A1C"
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
          />
          <Ellipse cx={110} cy={108} rx={3.4} ry={4} fill="#2E241A" />
          <Ellipse cx={130} cy={108} rx={3.4} ry={4} fill="#2E241A" />
          <Circle cx={111.2} cy={106.6} r={1.2} fill="#fff" opacity={0.9} />
          <Circle cx={131.2} cy={106.6} r={1.2} fill="#fff" opacity={0.9} />
          <Path
            d="M118 113 q2 4 4 0"
            stroke="#D9A97A"
            strokeWidth={1.8}
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d="M111 122 q9 8 18 0"
            stroke="#B9754F"
            strokeWidth={2.4}
            fill="none"
            strokeLinecap="round"
          />
          <Ellipse cx={99} cy={118} rx={6} ry={3.4} fill="#F0A98A" opacity={0.38} />
          <Ellipse cx={141} cy={118} rx={6} ry={3.4} fill="#F0A98A" opacity={0.38} />
          {acc === 'acc-glasses' ? (
            <G>
              <Circle
                cx={110}
                cy={108}
                r={11}
                fill="rgba(180,220,255,.14)"
                stroke="#2B2118"
                strokeWidth={2.6}
              />
              <Circle
                cx={130}
                cy={108}
                r={11}
                fill="rgba(180,220,255,.14)"
                stroke="#2B2118"
                strokeWidth={2.6}
              />
              <Path d="M121 108h-2" stroke="#2B2118" strokeWidth={2.6} />
            </G>
          ) : null}
          {acc === 'acc-hat' ? (
            <G>
              <Path d="M92 74h56l-5-24H97z" fill="#241C13" />
              <Path d="M86 74h68v6.4a5 5 0 0 1-5 5H91a5 5 0 0 1-5-5z" fill="#241C13" />
            </G>
          ) : null}
          {acc === 'acc-crown' ? (
            <G>
              <Path
                d="M90 78h60l-5-31-15 12-10-19-10 19-15-12z"
                fill="#FFC53D"
                stroke="#C08D22"
                strokeWidth={1.6}
              />
              <Circle cx={120} cy={49} r={3.2} fill="#FFF3CE" />
              <Circle cx={97} cy={56} r={2.4} fill="#FFF3CE" />
              <Circle cx={143} cy={56} r={2.4} fill="#FFF3CE" />
            </G>
          ) : null}
          {pet ? (
            <G>
              <Ellipse cx={196} cy={230} rx={26} ry={6} fill="#0C0907" opacity={0.5} />
              <Circle cx={196} cy={196} r={33} fill={pet.f} opacity={0.2} />
              <Circle cx={196} cy={196} r={30} fill="#191410" stroke={pet.r} strokeWidth={3} />
              <G transform="translate(176 176) scale(1.66)">
                <Path
                  d={pet.p}
                  fill="none"
                  stroke={pet.f}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </G>
            </G>
          ) : null}
        </Svg>
      </Animated.View>
    </View>
  );
}
