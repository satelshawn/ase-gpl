// Runs on plain node, no test framework. The vectors came from Suisai itself, whose reader is the
// reference implementation: if a change here stops these passing, the change is wrong.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readAse, writeAse, readGpl, writeGpl } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const vector = (name) => readFileSync(join(here, 'vectors', name));
const bytes = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);

let failures = 0;
function check(what, got, want) {
  const ok = got === want;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${what}`);
  if (!ok) {
    failures++;
    console.log(`        got  ${JSON.stringify(got)}`);
    console.log(`        want ${JSON.stringify(want)}`);
  }
}

// 1. ASE in, GPL out, byte for byte. Five colours: two RGB inside a group, one of them named with
//    an umlaut and a curly apostrophe, a GRAY, a CMYK marked spot, and an RGB with no name.
const ase = readAse(bytes(vector('sample.ase')));
const expected = vector('sample.expected.gpl').toString('utf8');
check('sample.ase -> gpl, byte for byte', writeGpl(ase.colours, 'sample'), expected);
check('every swatch converted', ase.skipped, 0);
check('the group was read past', ase.colours.length, 5);
check('non-ASCII name survives', ase.colours[1].name, 'Zoë’s Blue');
check('an empty name stays empty', ase.colours[4].name, '');

// 2. GPL in, forgiving. The file holds a Columns header, a comment, a blank line, mixed spacing,
//    a nameless colour, a channel over 255 and a line that is not a colour at all.
const messy = readGpl(bytes(vector('messy.gpl')));
check('messy.gpl yields four colours', messy.colours.length, 4);
check('inner spacing is the author\'s', messy.colours[3].name, 'Name with   inner spaces');
check('an out-of-range line is skipped', messy.colours.some((c) => c.rgb[0] > 255), false);
check('a nameless colour is kept', messy.colours[2].name, '');

// 3. Round trip. GPL to ASE and back must reproduce the same text, or the writer and the reader
//    disagree about something and one of them is wrong.
const back = readGpl(new TextEncoder().encode(expected).buffer);
check('gpl -> ase -> gpl reproduces itself', writeGpl(readAse(writeAse(back.colours)).colours, 'sample'), expected);

// 4. The other direction, which the round trip above does not reach. An unnamed swatch becomes
//    "Untitled" in GPL because the format needs something after the numbers, and must come back
//    out of ASE unnamed again rather than carrying a name nobody chose.
const trip = readAse(writeAse(readGpl(new TextEncoder().encode(writeGpl(ase.colours, 'sample')).buffer).colours));
check('ase -> gpl -> ase leaves the unnamed swatch unnamed', trip.colours[4].name, '');
check('and does not touch the named ones', trip.colours[0].name, 'Brand Primary');

console.log(failures ? `\n  ${failures} failed` : '\n  all passed');
process.exit(failures ? 1 : 0);
