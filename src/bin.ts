#!/usr/bin/env node

import * as fs from 'fs';
import minimist from 'minimist';
import { SSTVDecoder } from './decode';
import { SSTVEncoder } from './encode';
import { log_message } from './common';
import * as spec from './spec';
import { readWav, writeWav } from './audio';
import { PNG } from 'pngjs';

const args = minimist(process.argv.slice(2), {
    string: ['output', 'decode', 'encode', 'mode'],
    boolean: ['list-modes', 'help'],
    alias: {
        d: 'decode',
        e: 'encode',
        o: 'output',
        s: 'skip',
        m: 'mode',
        h: 'help'
    },
    default: {
        output: 'result.png',
        skip: 0.0,
        mode: 'Martin 1'
    }
});

if (args.help) {
    console.log(`
Usage: sstv [options]

Options:
  -d, --decode <file>   Decode SSTV audio file (WAV format)
  -e, --encode <file>   Encode image file to SSTV audio (PNG format)
  -o, --output <file>   Save output to custom location (default: result.png or result.wav)
  -m, --mode <mode>     SSTV mode to use for encoding (default: Martin 1)
  -s, --skip <seconds>  Time in seconds to start decoding signal at
  --list-modes          List supported SSTV modes
  -h, --help            Show this help message
`);
    process.exit(0);
}

if (args['list-modes']) {
    const modes = Object.values(spec.VIS_MAP).map(m => m.NAME).join(', ');
    console.log(`Supported modes: ${modes}`);
    process.exit(0);
}

if (args.decode) {
    const inputFile = args.decode;
    const outputFile = args.output === 'result.png' ? 'result.png' : args.output;
    const skip = parseFloat(args.skip);

    readWav(inputFile)
        .then(({ samples, sampleRate }) => {
            const decoder = new SSTVDecoder(samples, sampleRate);
            try {
                const png = decoder.decode(skip);
                if (png) {
                    png.pack().pipe(fs.createWriteStream(outputFile))
                        .on('finish', () => {
                            log_message(`Saved to ${outputFile}`);
                        });
                }
            } catch (e: any) {
                log_message(`Error decoding: ${e.message}`, true);
            }
        })
        .catch(err => {
            log_message(`Error reading file: ${err.message}`, true);
            process.exit(1);
        });
} else if (args.encode) {
    const inputFile = args.encode;
    const outputFile = args.output === 'result.png' ? 'result.wav' : args.output;
    const modeName = args.mode;

    // Find mode
    let mode: spec.SSTVMode | null = null;
    for (const m of Object.values(spec.VIS_MAP)) {
        if (m.NAME.toLowerCase() === modeName.toLowerCase()) {
            mode = m;
            break;
        }
    }

    if (!mode) {
        console.error(`Error: Unsupported mode '${modeName}'`);
        const modes = Object.values(spec.VIS_MAP).map(m => m.NAME).join(', ');
        console.error(`Supported modes: ${modes}`);
        process.exit(1);
    }

    fs.createReadStream(inputFile)
        .pipe(new PNG())
        .on('parsed', function () {
            try {
                const encoder = new SSTVEncoder();
                const samples = encoder.encode(this, mode!);

                writeWav(outputFile, { samples, sampleRate: 48000 })
                    .then(() => {
                        log_message(`Saved to ${outputFile}`);
                    })
                    .catch(err => {
                        log_message(`Error writing WAV: ${err.message}`, true);
                    });

            } catch (e: any) {
                log_message(`Error encoding: ${e.message}`, true);
            }
        })
        .on('error', (err) => {
            log_message(`Error reading PNG: ${err.message}`, true);
            process.exit(1);
        });

} else {
    console.error("Error: No input file specified. Use -d <file> or -e <file>");
    process.exit(1);
}
