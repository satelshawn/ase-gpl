// GIMP Palette, read and write. Plain text, and forgiving on the way in: a malformed line is
// skipped rather than failing the file, because these are hand-edited more often than not.

/** UTF-8, falling back to Latin-1 for older files written before anyone agreed on encodings. */
function decode(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

export function readGpl(buffer) {
  const text = decode(new Uint8Array(buffer));
  const lines = text.split(/\r\n|\r|\n/);
  if (!lines.length || !lines[0].startsWith('GIMP Palette')) {
    throw new Error('Not a GIMP palette: the first line must be "GIMP Palette"');
  }

  const colours = [];
  for (const line of lines.slice(1)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (/^\s*(Name|Columns)\s*:/i.test(line)) continue;

    // Three integers, any whitespace between. Everything after them is the name: inner spacing
    // is the author's and is kept, the ends are not.
    const m = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)(?:\s(.*))?$/);
    if (!m) continue;
    const rgb = [m[1], m[2], m[3]].map(Number);
    if (rgb.some((c) => c > 255)) continue;
    colours.push({ name: (m[4] ?? '').trim(), rgb });
  }
  return { colours, skipped: 0, models: new Set(['RGB']) };
}

/** Channels right-aligned to three characters, single spaces between, a tab before the name. */
import { isUnnamed } from './colour.js';

export function writeGpl(colours, paletteName = 'Untitled') {
  const rows = colours.map(({ name, rgb }) => {
    const n = rgb.map((c) => String(c).padStart(3)).join(' ');
    // One swatch is one line. A name can carry a line break or a tab (ASE allows anything), and
    // written as it stands that would end the line early and leave the rest as a stray one.
    const flat = (name ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
    // GPL needs something after the numbers, so an unnamed swatch is given the one word Suisai
    // uses for the same case rather than being written out blank.
    return `${n}\t${isUnnamed(flat) ? 'Untitled' : flat}`;
  });
  return `GIMP Palette\nName: ${paletteName}\nColumns: 0\n#\n${rows.join('\n')}\n`;
}
