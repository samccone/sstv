#!/usr/bin/env node

const fs = require('fs');
const wav = require('wav');
const minimist = require('minimist');
const SSTVDecoder = require('./decode');
const { log_message } = require('./common');

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
    const spec = require('./spec');
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

const file = fs.createReadStream(inputFile);
const reader = new wav.Reader();

const samples = [];
let sampleRate = 0;
let wavFormat = null;

reader.on('format', function (format) {
    wavFormat = format;
    sampleRate = format.sampleRate;
    if (format.bitDepth !== 16 && format.bitDepth !== 8) {
        console.error(`Unsupported bit depth: ${format.bitDepth}. Only 8 and 16 bit WAV files are supported.`);
        process.exit(1);
    }
});

reader.on('data', function (chunk) {
    // Assuming 16-bit signed LE or 8-bit unsigned
    // We need to convert to float -1.0 to 1.0
    // And mix to mono if stereo

    // We can't easily know the format here without storing it from 'format' event, 
    // but 'data' might fire before 'format' in some streams? No, 'format' should be first for wav.Reader.
    // But we need to access format info here.
    // Actually wav.Reader emits 'format' then pipes data.
    // Let's just collect buffer chunks and process at end to be safe and simple.
    samples.push(chunk);
});

reader.on('end', function () {
    if (!wavFormat) {
        console.error("Error: Could not determine WAV format.");
        process.exit(1);
    }
    const buffer = Buffer.concat(samples);
    const format = wavFormat;

    let floatSamples;
    const numChannels = format.channels;
    const bitDepth = format.bitDepth;
    const numSamples = buffer.length / (bitDepth / 8) / numChannels;

    floatSamples = new Float32Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
        let sum = 0;
        for (let c = 0; c < numChannels; c++) {
            let val = 0;
            const offset = (i * numChannels + c) * (bitDepth / 8);

            if (bitDepth === 16) {
                val = buffer.readInt16LE(offset) / 32768.0;
            } else if (bitDepth === 8) {
                val = (buffer.readUInt8(offset) - 128) / 128.0;
            }
            sum += val;
        }
        floatSamples[i] = sum / numChannels;
    }

    const decoder = new SSTVDecoder(floatSamples, sampleRate);
    try {
        const png = decoder.decode(skip);
        if (png) {
            png.pack().pipe(fs.createWriteStream(outputFile))
                .on('finish', () => {
                    log_message(`Saved to ${outputFile}`);
                });
        }
    } catch (e) {
        log_message(`Error decoding: ${e.message}`, true);
    }
});

file.pipe(reader);
