import { useCallback, useRef, useState } from "react";

interface ChartPoint {
  x: number;
  [key: string]: any;
}

interface UseChartInteractionOptions<T> {
  /** Reference to the SVG element */
  svgRef: React.RefObject<SVGSVGElement | null>;
  /** Array of chart points with x coordinates */
  points: ChartPoint[];
  /** SVG viewBox width (used to calculate normalized coordinates) */
  width: number;
  /** Callback when hover data changes */
  onHover?: (data: T | null) => void;
  /** Maps a point to the data structure expected by onHover */
  mapPointToHoverData: (point: ChartPoint, index: number) => T;
}

interface ChartInteractionHandlers {
  onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerMove: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerUp: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerLeave: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerCancel: (e: React.PointerEvent<SVGSVGElement>) => void;
}

interface UseChartInteractionResult {
  /** Index of the currently hovered point, or null */
  hoverIndex: number | null;
  /** Event handlers to spread on the SVG element */
  handlers: ChartInteractionHandlers;
}

/**
 * Hook for unified mouse and touch interaction on SVG charts.
 *
 * Uses Pointer Events API to handle both mouse hover and touch drag.
 * - Mouse: hover shows indicator, leave clears it
 * - Touch: press and drag shows indicator, lift clears it
 *
 * Usage:
 * ```tsx
 * const { hoverIndex, handlers } = useChartInteraction({
 *   svgRef,
 *   points,
 *   width,
 *   onHover,
 *   mapPointToHoverData: (point) => ({ value: point.value, date: point.date }),
 * });
 *
 * <svg
 *   ref={svgRef}
 *   style={{ touchAction: 'none' }}
 *   {...handlers}
 * >
 * ```
 */
export function useChartInteraction<T>({
  svgRef,
  points,
  width,
  onHover,
  mapPointToHoverData,
}: UseChartInteractionOptions<T>): UseChartInteractionResult {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const activePointerIdRef = useRef<number | null>(null);

  const findClosestPoint = useCallback(
    (clientX: number): number | null => {
      if (!svgRef.current || points.length === 0) return null;

      const rect = svgRef.current.getBoundingClientRect();
      const normalizedX = ((clientX - rect.left) / rect.width) * width;

      let closest = 0;
      let closestDist = Infinity;

      for (let i = 0; i < points.length; i++) {
        const dist = Math.abs(points[i].x - normalizedX);
        if (dist < closestDist) {
          closestDist = dist;
          closest = i;
        }
      }

      return closest;
    },
    [svgRef, points, width]
  );

  const updateHover = useCallback(
    (index: number | null) => {
      setHoverIndex(index);
      if (index !== null && points[index]) {
        onHover?.(mapPointToHoverData(points[index], index));
      } else {
        onHover?.(null);
      }
    },
    [points, onHover, mapPointToHoverData]
  );

  const clearHover = useCallback(() => {
    activePointerIdRef.current = null;
    updateHover(null);
  }, [updateHover]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      // Only track one pointer at a time
      if (activePointerIdRef.current !== null) return;

      activePointerIdRef.current = e.pointerId;

      // Capture pointer for touch to track drags outside element
      if (e.pointerType === "touch") {
        e.currentTarget.setPointerCapture(e.pointerId);
      }

      const index = findClosestPoint(e.clientX);
      updateHover(index);
    },
    [findClosestPoint, updateHover]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      // For mouse: always track hover (no pointer capture needed)
      // For touch: only track if we have an active pointer (started with pointerdown)
      if (e.pointerType === "mouse" || activePointerIdRef.current === e.pointerId) {
        const index = findClosestPoint(e.clientX);
        updateHover(index);
      }
    },
    [findClosestPoint, updateHover]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (activePointerIdRef.current === e.pointerId) {
        if (e.pointerType === "touch") {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
        clearHover();
      }
    },
    [clearHover]
  );

  const onPointerLeave = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      // For mouse, clear on leave (unless a touch pointer is captured)
      // For touch with capture, onPointerUp handles clearing
      if (e.pointerType === "mouse" && activePointerIdRef.current === null) {
        clearHover();
      } else if (activePointerIdRef.current === e.pointerId) {
        // Touch pointer left without releasing (shouldn't happen with capture, but handle it)
        clearHover();
      }
    },
    [clearHover]
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (activePointerIdRef.current === e.pointerId) {
        clearHover();
      }
    },
    [clearHover]
  );

  return {
    hoverIndex,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerLeave,
      onPointerCancel,
    },
  };
}
