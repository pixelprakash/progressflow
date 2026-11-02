import { useMemo, useRef, useState } from 'react';
import { Image, PanResponder, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import Svg, { Ellipse, Line, Polygon, Polyline } from 'react-native-svg';
import type { AnnotationStroke, AnnotationTool } from '@progressflow/shared';

/**
 * Photo + vector markup. Points are stored normalised (0..1 of the photo) so
 * marks line up at any screen size and survive rotation. `visible=false`
 * hides the markup without deleting it — the teacher's show/hide switch.
 */

export const STROKE_WIDTH: Record<AnnotationTool, number> = {
  circle: 4,
  arrow: 4,
  freehand: 4,
  highlight: 18,
};

type Pt = [number, number];

export function AnnotationCanvas({
  uri,
  imageWidth,
  imageHeight,
  height,
  strokes,
  visible,
  drawing,
  tool,
  color,
  onAdd,
}: {
  uri: string;
  imageWidth: number;
  imageHeight: number;
  height: number;
  strokes: AnnotationStroke[];
  visible: boolean;
  drawing: boolean;
  tool: AnnotationTool;
  color: string;
  onAdd: (s: AnnotationStroke) => void;
}) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [draft, setDraft] = useState<Pt[] | null>(null);
  const live = useRef({ drawing, tool, color, onAdd, rw: 1, rh: 1 });

  const scale = box.w && box.h ? Math.min(box.w / imageWidth, box.h / imageHeight) : 0;
  const rw = imageWidth * scale;
  const rh = imageHeight * scale;
  live.current = { drawing, tool, color, onAdd, rw, rh };

  const pts = useRef<Pt[]>([]);
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => live.current.drawing,
        onMoveShouldSetPanResponder: () => live.current.drawing,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          pts.current = [norm(e.nativeEvent.locationX, e.nativeEvent.locationY)];
          setDraft([...pts.current]);
        },
        onPanResponderMove: (e) => {
          const p = norm(e.nativeEvent.locationX, e.nativeEvent.locationY);
          const t = live.current.tool;
          if (t === 'circle' || t === 'arrow') pts.current = [pts.current[0] ?? p, p];
          else pts.current.push(p);
          setDraft([...pts.current]);
        },
        onPanResponderRelease: () => {
          const { tool: t, color: c, onAdd: add, rw: w, rh: h } = live.current;
          const p = pts.current;
          const first = p[0];
          const last = p[p.length - 1];
          if (first && last && p.length > 1) {
            const moved = Math.hypot((last[0] - first[0]) * w, (last[1] - first[1]) * h);
            if (moved > 8) add({ tool: t, color: c, width: STROKE_WIDTH[t], points: p });
          }
          pts.current = [];
          setDraft(null);
        },
      }),
    [],
  );

  function norm(x: number, y: number): Pt {
    const { rw: w, rh: h } = live.current;
    return [Math.min(1, Math.max(0, x / (w || 1))), Math.min(1, Math.max(0, y / (h || 1)))];
  }

  const onLayout = (e: LayoutChangeEvent) =>
    setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const shown: AnnotationStroke[] = visible ? strokes : [];
  const draftStroke: AnnotationStroke | null =
    visible && draft && draft.length > 1
      ? { tool, color, width: STROKE_WIDTH[tool], points: draft }
      : null;

  return (
    <View style={{ height, backgroundColor: '#1d1d1d' }} onLayout={onLayout}>
      <Image
        source={{ uri }}
        style={{ width: '100%', height: '100%' }}
        resizeMode="contain"
        accessibilityLabel="Student artwork"
      />
      {scale > 0 ? (
        <View
          {...responder.panHandlers}
          style={{
            position: 'absolute',
            left: (box.w - rw) / 2,
            top: (box.h - rh) / 2,
            width: rw,
            height: rh,
          }}
        >
          <Svg width={rw} height={rh} pointerEvents="none">
            {[...shown, ...(draftStroke ? [draftStroke] : [])].map((st, i) => (
              <Mark key={i} s={st} w={rw} h={rh} />
            ))}
          </Svg>
        </View>
      ) : null}
    </View>
  );
}

function Mark({ s, w, h }: { s: AnnotationStroke; w: number; h: number }) {
  const P = s.points.map(([x, y]) => [x * w, y * h] as const);
  const first = P[0];
  const last = P[P.length - 1];
  if (!first || !last) return null;

  if (s.tool === 'circle') {
    return (
      <Ellipse
        cx={(first[0] + last[0]) / 2}
        cy={(first[1] + last[1]) / 2}
        rx={Math.abs(last[0] - first[0]) / 2}
        ry={Math.abs(last[1] - first[1]) / 2}
        stroke={s.color}
        strokeWidth={s.width}
        fill="none"
      />
    );
  }
  if (s.tool === 'arrow') {
    const ang = Math.atan2(last[1] - first[1], last[0] - first[0]);
    const L = 18;
    const a1 = [last[0] - L * Math.cos(ang - 0.45), last[1] - L * Math.sin(ang - 0.45)];
    const a2 = [last[0] - L * Math.cos(ang + 0.45), last[1] - L * Math.sin(ang + 0.45)];
    return (
      <>
        <Line
          x1={first[0]}
          y1={first[1]}
          x2={last[0]}
          y2={last[1]}
          stroke={s.color}
          strokeWidth={s.width}
          strokeLinecap="round"
        />
        <Polygon points={`${last[0]},${last[1]} ${a1.join(',')} ${a2.join(',')}`} fill={s.color} />
      </>
    );
  }
  return (
    <Polyline
      points={P.map((p) => p.join(',')).join(' ')}
      stroke={s.color}
      strokeWidth={s.width}
      strokeOpacity={s.tool === 'highlight' ? 0.35 : 1}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  );
}
