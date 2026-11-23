import type { HexColor } from './types';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const CHANNEL_MAX = 255;
const HEX_RADIX = 16;
const RED_OFFSET = 1;
const GREEN_OFFSET = 3;
const BLUE_OFFSET = 5;
const CHANNEL_DIGITS = 2;

export function isHexColor(value: string): value is HexColor {
  return HEX_COLOR.test(value);
}

/** Converts "#rrggbb" to RGB components in the 0…1 range used by PDF. */
export function hexToRgb(color: HexColor): [number, number, number] {
  if (!HEX_COLOR.test(color)) {
    throw new RangeError(`Invalid colour: ${color}`);
  }
  const channel = (offset: number): number =>
    Number.parseInt(color.slice(offset, offset + CHANNEL_DIGITS), HEX_RADIX) / CHANNEL_MAX;
  return [channel(RED_OFFSET), channel(GREEN_OFFSET), channel(BLUE_OFFSET)];
}
