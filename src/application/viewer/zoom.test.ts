import { describe, expect, it } from 'vitest';
import {
  clampZoom,
  fitPageZoom,
  fitWidthZoom,
  MAX_ZOOM,
  MIN_ZOOM,
  nextZoomStep,
  previousZoomStep,
  zoomFromWheel,
  zoomToPercent,
} from './zoom';

const A4 = { width: 595, height: 842 };

describe('zoom', () => {
  it('clamps to the allowed range', () => {
    expect(clampZoom(0)).toBe(MIN_ZOOM);
    expect(clampZoom(100)).toBe(MAX_ZOOM);
    expect(clampZoom(1.3)).toBe(1.3);
  });

  it('steps through the zoom levels', () => {
    expect(nextZoomStep(1)).toBe(1.1);
    expect(previousZoomStep(1)).toBe(0.9);
    expect(nextZoomStep(1.05)).toBe(1.1);
    expect(previousZoomStep(1.05)).toBe(1);
    expect(nextZoomStep(MAX_ZOOM)).toBe(MAX_ZOOM);
    expect(previousZoomStep(MIN_ZOOM)).toBe(MIN_ZOOM);
  });

  it('zooms in when the wheel goes up and out when it goes down', () => {
    expect(zoomFromWheel(1, -100)).toBeCloseTo(1.1);
    expect(zoomFromWheel(1, 100)).toBeCloseTo(1 / 1.1);
    expect(zoomFromWheel(MAX_ZOOM, -1000)).toBe(MAX_ZOOM);
  });

  it('fits the widest page to the viewport width', () => {
    const zoom = fitWidthZoom([A4, { width: 842, height: 595 }], { width: 900, height: 600 }, 16);
    expect(zoom).toBeCloseTo((900 - 32) / 842);
  });

  it('fits a whole page into the viewport', () => {
    const zoom = fitPageZoom(A4, { width: 1200, height: 700 }, 10);
    expect(zoom).toBeCloseTo(680 / 842);
  });

  it('falls back to 100% for empty input', () => {
    expect(fitWidthZoom([], { width: 900, height: 600 }, 0)).toBe(1);
    expect(fitPageZoom({ width: 0, height: 0 }, { width: 900, height: 600 }, 0)).toBe(1);
  });

  it('shows zoom as a percentage', () => {
    expect(zoomToPercent(1.256)).toBe(126);
  });
});
