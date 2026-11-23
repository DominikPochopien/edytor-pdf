import type { Size } from '../../domain/geometry';

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 6;
export const DEFAULT_ZOOM = 1;

/* eslint-disable @typescript-eslint/no-magic-numbers -- tables of zoom levels shown to the user */
/** Zoom levels used by the "+" and "−" buttons. */
export const ZOOM_STEPS: readonly number[] = [
  0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5, 6,
];

/** Zoom presets offered in the zoom menu. */
export const ZOOM_PRESETS: readonly number[] = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
/* eslint-enable @typescript-eslint/no-magic-numbers */

/** Multiplier applied per standard mouse-wheel notch (deltaY = 100) with Ctrl held. */
const WHEEL_ZOOM_FACTOR_PER_NOTCH = 1.1;
const WHEEL_NOTCH_DELTA = 100;
const ZOOM_EPSILON = 1e-3;

export type ZoomMode = 'custom' | 'fit-width' | 'fit-page';

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function nextZoomStep(current: number): number {
  return ZOOM_STEPS.find((step) => step > current + ZOOM_EPSILON) ?? MAX_ZOOM;
}

export function previousZoomStep(current: number): number {
  return [...ZOOM_STEPS].reverse().find((step) => step < current - ZOOM_EPSILON) ?? MIN_ZOOM;
}

/** Continuous zoom for Ctrl + mouse wheel / trackpad pinch. */
export function zoomFromWheel(current: number, deltaY: number): number {
  const factor = WHEEL_ZOOM_FACTOR_PER_NOTCH ** (-deltaY / WHEEL_NOTCH_DELTA);
  return clampZoom(current * factor);
}

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

/** Zoom at which the widest page fills the viewport width (minus padding). */
export function fitWidthZoom(pages: readonly Size[], viewport: Viewport, padding: number): number {
  const widest = Math.max(...pages.map((p) => p.width));
  if (!Number.isFinite(widest) || widest <= 0) {
    return DEFAULT_ZOOM;
  }
  return clampZoom((viewport.width - 2 * padding) / widest);
}

/** Zoom at which a whole page is visible. */
export function fitPageZoom(page: Size, viewport: Viewport, padding: number): number {
  if (page.width <= 0 || page.height <= 0) {
    return DEFAULT_ZOOM;
  }
  const byWidth = (viewport.width - 2 * padding) / page.width;
  const byHeight = (viewport.height - 2 * padding) / page.height;
  return clampZoom(Math.min(byWidth, byHeight));
}

export function zoomToPercent(zoom: number): number {
  return Math.round(zoom * 100);
}
