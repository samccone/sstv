#!/usr/bin/env node

import * as fs from 'fs';
import minimist from 'minimist';
import { SSTVDecoder } from './decode';
import { log_message } from './common';
import * as spec from './spec';
import { readWav } from './audio';

const args = minimist(process.argv.slice(2), {
    string: ['output', 'decode'],
    boolean: ['list-modes', 'help'],
    alias: {
        d: 'decode',
        o: 'output',
        s: 'skip',
        h: 'help'
    },
    default: {
        output: 'result.png',
        skip: 0.0
    }
});

if (args.help) {
    console.log(`
Usage: sstv [options]

Options:
  -d, --decode <file>   Decode SSTV audio file (WAV format)
  -o, --output <file>   Save output image to custom location (default: result.png)
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

if (!args.decode) {
    console.error("Error: No input file specified. Use -d <file>");
    process.exit(1);
}

const inputFile = args.decode;
const outputFile = args.output;
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
