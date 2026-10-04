// Colour conversions for the palette converter. No dependencies, no DOM: this file and its two
// neighbours are the whole converter, and are meant to lift out of this site unchanged.

/** Clamp to 0-255 and round, the last step of every model below. */
const byte = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));

export const rgbFromUnit = ([r, g, b]) => [byte(r), byte(g), byte(b)];

/** ASE "GRAY": one channel used for all three. */
export const rgbFromGray = ([g]) => {
  const v = byte(g);
  return [v, v, v];
};

/**
 * ASE "CMYK", the plain formula.
 *
 * Deliberately not colour-managed. A browser cannot apply an ICC profile, so this is an
 * approximation and the page says so: pure cyan lands on #00FFFF here and on #00A3DA through
 * Suisai's own CMYK profile. That gap is real and is the honest reason to point at the app.
 */
export const rgbFromCmyk = ([c, m, y, k]) => [
  byte((1 - c) * (1 - k)),
  byte((1 - m) * (1 - k)),
  byte((1 - y) * (1 - k)),
];

// Bradford adaptation, D50 to D65. ASE stores Lab against D50; sRGB is defined against D65, so
// skipping this step tints every Lab swatch slightly warm.
const BRADFORD_D50_D65 = [
  [0.9555766, -0.0230393, 0.0631636],
  [-0.0282895, 1.0099416, 0.0210077],
  [0.0122982, -0.0204830, 1.3299098],
];

// XYZ (D65) to linear sRGB.
const XYZ_TO_RGB = [
  [3.2404542, -1.5371385, -0.4985314],
  [-0.9692660, 1.8760108, 0.0415560],
  [0.0556434, -0.2040259, 1.0572252],
];

const apply = (m, [x, y, z]) => m.map((r) => r[0] * x + r[1] * y + r[2] * z);

/** sRGB transfer function, linear light to encoded. */
const encode = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

/**
 * ASE "LAB ": L arrives 0-1 and is scaled to 0-100, a and b as given, against D50.
 */
export const rgbFromLab = ([l, a, bb]) => {
  const L = l * 100;
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - bb / 200;
  const inv = (t) => (t > 6 / 29 ? t * t * t : 3 * (6 / 29) ** 2 * (t - 4 / 29));
  // D50 white point
  const xyz50 = [0.96422 * inv(fx), 1.0 * inv(fy), 0.82521 * inv(fz)];
  const lin = apply(XYZ_TO_RGB, apply(BRADFORD_D50_D65, xyz50));
  return lin.map((c) => byte(encode(Math.max(0, Math.min(1, c)))));
};
