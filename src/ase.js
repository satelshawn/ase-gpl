// Adobe Swatch Exchange, read and write. Big-endian throughout.
//
// The format nests colours in groups. This reads past the group markers and returns a flat list,
// which is what every destination format wants and what Suisai itself does.
import { rgbFromUnit, rgbFromGray, rgbFromCmyk, rgbFromLab, isUnnamed } from './colour.js';

const COLOUR = 0x0001;
const GROUP_START = 0xc001;
const GROUP_END = 0xc002;

const FLOATS = { 'RGB ': 3, 'GRAY': 1, 'CMYK': 4, 'LAB ': 3 };
const TO_RGB = { 'RGB ': rgbFromUnit, 'GRAY': rgbFromGray, 'CMYK': rgbFromCmyk, 'LAB ': rgbFromLab };

/**
 * @returns {{ colours: {name: string, rgb: [number,number,number]}[], skipped: number }}
 *   `skipped` counts swatches in a colour model this cannot convert. They are reported rather
 *   than guessed at, because a silently wrong colour is worse than a missing one. `models` is
 *   which models were actually seen, so the page can name the CMYK approximation only when a
 *   file contains one rather than warning everybody about something that did not happen.
 *   `truncated` is true when the file ended before its last block did; the colours before that
 *   point are returned.
 */
export function readAse(buffer) {
  const v = new DataView(buffer);
  if (v.byteLength < 12) throw new Error('Not an ASE file: too short');
  const sig = String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3));
  if (sig !== 'ASEF') throw new Error('Not an ASE file: missing ASEF signature');

  const blocks = v.getUint32(8);
  const colours = [];
  const models = new Set();
  let skipped = 0;
  let truncated = false;
  let at = 12;

  for (let i = 0; i < blocks && at + 6 <= v.byteLength; i++) {
    const type = v.getUint16(at);
    const length = v.getUint32(at + 2);
    const body = at + 6;
    // A block that claims more than the file holds means the file was cut short. Keep what was
    // read before it and stop, as Suisai does, rather than reading past the end.
    if (body + length > v.byteLength) { truncated = true; break; }
    // Always step by the block's own length. Stepping by what was parsed desynchronises the
    // whole file the moment one block holds something unexpected.
    at = body + length;

    if (type === GROUP_START || type === GROUP_END) continue;
    if (type !== COLOUR) continue;

    let p = body;
    // Every read below stays inside this block; a block whose own fields overrun it is damaged.
    const end = body + length;
    if (length < 2) { skipped++; continue; }
    const nameUnits = v.getUint16(p); p += 2;           // includes the trailing null
    if (p + nameUnits * 2 + 4 > end) { skipped++; continue; }
    let name = '';
    for (let u = 0; u < nameUnits; u++, p += 2) {
      const code = v.getUint16(p);
      if (code !== 0) name += String.fromCharCode(code);
    }
    const model = String.fromCharCode(v.getUint8(p), v.getUint8(p + 1), v.getUint8(p + 2), v.getUint8(p + 3));
    p += 4;
    const count = FLOATS[model];
    if (!count || p + count * 4 > end) { skipped++; continue; }
    const values = [];
    for (let f = 0; f < count; f++, p += 4) values.push(v.getFloat32(p));
    models.add(model.trim());
    colours.push({ name, rgb: TO_RGB[model](values) });
  }
  return { colours, skipped, models, truncated };
}

/** UTF-16 code units of a name. Not code points: a character outside the basic plane, an emoji
 *  say, is two units, and the format counts and stores units. */
const units = (name) => Array.from({ length: name.length }, (_, i) => name.charCodeAt(i));

/** One colour block each, model "RGB ", kind 2 (normal), no groups. */
export function writeAse(colours) {
  const names = colours.map((c) => (isUnnamed(c.name) ? [] : units(c.name)));
  const size = 12 + names.reduce((n, chars) => n + 6 + 2 + (chars.length + 1) * 2 + 4 + 12 + 2, 0);
  const buf = new ArrayBuffer(size);
  const v = new DataView(buf);

  'ASEF'.split('').forEach((ch, i) => v.setUint8(i, ch.charCodeAt(0)));
  v.setUint16(4, 1);
  v.setUint16(6, 0);
  v.setUint32(8, colours.length);

  let at = 12;
  colours.forEach((c, i) => {
    const chars = names[i];
    const length = 2 + (chars.length + 1) * 2 + 4 + 12 + 2;
    v.setUint16(at, 0x0001); at += 2;
    v.setUint32(at, length); at += 4;
    v.setUint16(at, chars.length + 1); at += 2;        // the null is counted
    for (const unit of chars) { v.setUint16(at, unit); at += 2; }
    v.setUint16(at, 0); at += 2;
    'RGB '.split('').forEach((ch) => { v.setUint8(at, ch.charCodeAt(0)); at += 1; });
    for (const channel of c.rgb) { v.setFloat32(at, channel / 255); at += 4; }
    v.setUint16(at, 2); at += 2;
  });
  return buf;
}
