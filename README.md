# ase-gpl

Read and write **Adobe Swatch Exchange** (`.ase`) and **GIMP palette** (`.gpl`) files.
No dependencies, no DOM, no filesystem. Works in a browser and in Node.

Live demo, converting both ways with nothing uploaded:
**[suisai.design/convert-palettes](https://suisai.design/convert-palettes/)**

## Install

Copy `src/` into your project, or:

```sh
git clone https://github.com/satelshawn/ase-gpl.git
```

Not on npm. Open an issue if you want it there.

## Use

Everything takes and returns an `ArrayBuffer` or a string. Nothing touches the disk, so the
same code runs in a browser, a worker, or Node.

```js
import { readAse, writeGpl } from './src/index.js';

const { colours, skipped, models } = readAse(arrayBuffer);
// colours: [{ name: 'Brand Primary', rgb: [142, 43, 18] }, …]
// skipped: swatches in a colour model this cannot read
// models:  Set of the models the file used, e.g. 'RGB', 'GRAY', 'CMYK', 'LAB'

const text = writeGpl(colours, 'My palette');   // a string, ready to save as .gpl
```

The other direction:

```js
import { readGpl, writeAse } from './src/index.js';

const { colours } = readGpl(arrayBuffer);
const buffer = writeAse(colours);               // an ArrayBuffer, ready to save as .ase
```

In a browser, that is all you need to convert a dropped file without a server:

```js
const { colours } = readAse(await file.arrayBuffer());
const blob = new Blob([writeGpl(colours, 'palette')], { type: 'text/plain' });
```

## What it does carefully

**Names survive.** A conversion that returns only hex values has thrown away half the file.
Swatch names are read, kept and written back. Non-ASCII names round-trip; one of the test
vectors is named `Zoë’s Blue` for that reason.

**Unnamed stays unnamed.** GPL cannot express "no name": the format needs something after the
numbers, so it writes `Untitled`. Reading that back as a real name would be lossy, so
`Untitled` means unnamed and an ASE written from it carries an empty name. Suisai then gives
it one from its colour list, which is what should happen to a swatch nobody named.

**Groups are read past.** ASE nests colours in groups. The result is a flat list, which is
what every destination format wants.

**Blocks are skipped by their own length**, never by what was parsed. A file holding something
unexpected stays readable instead of desynchronising from the first surprise.

**Malformed `.gpl` lines are skipped, not fatal.** These files are hand-edited more often than
not. A line with a channel over 255, or no numbers at all, is ignored and the rest is read.

**Encoding falls back.** A `.gpl` file is read as UTF-8, then as Windows-1252 for older files written
before anyone agreed on encodings.

**A damaged file is reported, not thrown.** An `.ase` cut short, by a failed download or a bad
copy, returns the swatches that were whole with `truncated: true` beside them. A converter that
dies on a damaged file tells its user nothing.

**Emoji survive.** ASE counts and stores UTF-16 units, not characters, so a name outside the
basic plane has to be written two units at a time. `Sunset 🌅` round-trips.

**One swatch stays one line.** ASE allows a line break or a tab inside a name; GPL is
line-based and would be broken by one. Control characters are flattened to a space on the way
out.

## What it does not do

**CMYK is an approximation.** Converting CMYK properly needs an ICC profile, which a browser
cannot apply. This uses the plain formula, so pure cyan lands on `#00FFFF`. A colour-managed
conversion gives `#00A3DA`. If that difference matters to you, this is not the right tool for
that file.

**ASE is written as RGB only**, one colour block per swatch, no groups. Everything read is
converted to sRGB first.

**`.aco` and `.clr` are not supported.** Photoshop swatches and Apple colour lists are real
formats and are out of scope here.

## Tests

```sh
npm test      # or: node test/run.js
```

The vectors in `test/vectors/` came from [Suisai](https://suisai.design), whose own reader is
the reference implementation. `sample.ase` converts to `sample.expected.gpl` byte for byte.
If a change stops that passing, the change is wrong.

An `.ase` written by this library opens in Suisai with its names intact, which is the check
that matters: the app's reader is stricter than this one.

## Where it came from

Suisai is a colour toolbox for macOS. It reads four palette formats and writes thirteen, and
this is the part of that job that is small enough to be useful on its own. The
[converter page](https://suisai.design/convert-palettes/) runs exactly this code in the
browser, which is also how the claim that nothing is uploaded can be checked: load the page,
switch your network off, and it still works.

## Licence

MIT. See [LICENSE](LICENSE).

The `gpl` in the name is the GIMP palette file extension, not the GNU General Public
Licence. This library is MIT.
