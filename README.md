# SSTV - Slow Scan Television Decoder & Encoder

A robust TypeScript library and CLI tool for decoding and encoding Slow Scan Television (SSTV) signals.

## Features

- **Decode** SSTV audio (WAV) into images (PNG).
- **Encode** images (PNG) into SSTV audio (WAV).
- **High Precision** frequency analysis for accurate color rendering.
- **CLI** for easy terminal usage.
- **TypeScript** API for programmatic integration.
- Supports **Martin 1** mode (with architecture for more).

## Installation

```bash
npm install sstv
```

## CLI Usage

### Decoding
Decode a WAV file containing an SSTV signal:

```bash
sstv -d input.wav -o output.png
```

### Encoding
Encode a PNG image into an SSTV audio signal:

```bash
sstv -e input.png -o output.wav
```

### Options
- `-d, --decode <file>`: Input WAV file to decode.
- `-e, --encode <file>`: Input PNG file to encode.
- `-o, --output <file>`: Output file path (default: `result.png` or `result.wav`).
- `-m, --mode <mode>`: SSTV mode for encoding (default: "Martin 1").
- `-s, --skip <seconds>`: Skip the first N seconds of the audio file.
- `--list-modes`: List all supported modes.
- `-h, --help`: Show help message.

## Programmatic Usage

### Decoder

```typescript
import { readWav, SSTVDecoder } from 'sstv';
import * as fs from 'fs';

// Read WAV file
const { samples, sampleRate } = await readWav('input.wav');

// Create decoder
const decoder = new SSTVDecoder(samples, sampleRate);

// Decode
const png = decoder.decode();

// Save image
if (png) {
    png.pack().pipe(fs.createWriteStream('output.png'));
}
```

### Encoder

```typescript
import { SSTVEncoder, spec, writeWav } from 'sstv';
import { PNG } from 'pngjs';
import * as fs from 'fs';

// Load PNG
const png = PNG.sync.read(fs.readFileSync('input.png'));

// Create encoder
const encoder = new SSTVEncoder();

// Encode (Martin 1)
const samples = encoder.encode(png, spec.M1);

// Save WAV
await writeWav('output.wav', { samples, sampleRate: 48000 });
```

## Supported Modes

| Mode | Decode | Encode |
|------|:------:|:------:|
| **Martin 1** | ✅ | ✅ |
| **Martin 2** | ✅ | ❌ |
| **Scottie 1** | ✅ | ❌ |
| **Scottie 2** | ✅ | ❌ |
| **Scottie DX** | ✅ | ❌ |
| **Robot 36** | ✅ | ❌ |
| **Robot 72** | ✅ | ❌ |

## License

MIT
