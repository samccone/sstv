import * as fs from 'fs';
// @ts-ignore
import * as wav from 'wav';

export interface AudioData {
    samples: Float32Array;
    sampleRate: number;
}

export function readWav(inputFile: string): Promise<AudioData> {
    return new Promise((resolve, reject) => {
        const file = fs.createReadStream(inputFile);
        const reader = new wav.Reader();

        const samples: Buffer[] = [];
        let sampleRate = 0;
        let wavFormat: any = null;

        reader.on('format', function (format: any) {
            wavFormat = format;
            sampleRate = format.sampleRate;
            if (format.bitDepth !== 16 && format.bitDepth !== 8) {
                reject(new Error(`Unsupported bit depth: ${format.bitDepth}. Only 8 and 16 bit WAV files are supported.`));
            }
        });

        reader.on('data', function (chunk: Buffer) {
            samples.push(chunk);
        });

        reader.on('end', function () {
            if (!wavFormat) {
                reject(new Error("Error: Could not determine WAV format."));
                return;
            }
            const buffer = Buffer.concat(samples);
            const format = wavFormat;

            let floatSamples: Float32Array;
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

            resolve({ samples: floatSamples, sampleRate });
        });

        reader.on('error', reject);
        file.on('error', reject);

        file.pipe(reader);
    });
}

export function writeWav(outputFile: string, audioData: AudioData): Promise<void> {
    return new Promise((resolve, reject) => {
        const writer = new wav.Writer({
            channels: 1,
            sampleRate: audioData.sampleRate,
            bitDepth: 16
        });

        const file = fs.createWriteStream(outputFile);

        writer.pipe(file);

        const samples = audioData.samples;
        const buffer = Buffer.alloc(samples.length * 2);

        for (let i = 0; i < samples.length; i++) {
            let s = Math.max(-1, Math.min(1, samples[i]));
            s = s < 0 ? s * 0x8000 : s * 0x7FFF;
            buffer.writeInt16LE(Math.round(s), i * 2);
        }

        writer.write(buffer);
        writer.end();

        writer.on('finish', resolve);
        writer.on('error', reject);
        file.on('error', reject);
    });
}
