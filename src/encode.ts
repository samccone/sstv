
import { PNG } from 'pngjs';
import * as spec from './spec';
import { log_message, progress_bar } from './common';

export class SSTVEncoder {
    _sample_rate: number;
    _samples: Float32Array;
    _phase: number;

    constructor(sampleRate: number = 48000) {
        this._sample_rate = sampleRate;
        this._samples = new Float32Array(0);
        this._phase = 0;
    }

    encode(image: PNG, mode: spec.SSTVMode): Float32Array {
        log_message(`Encoding image to SSTV (${mode.NAME})...`);

        // 1. Resize/Crop image if necessary (simplified: assume correct input for now or just take top-left)
        // Ideally we would resize, but for this PoC we'll assume the user provides a compatible image or we just read what we can.
        if (image.width !== mode.LINE_WIDTH || image.height !== mode.LINE_COUNT) {
            log_message(`Warning: Image dimensions (${image.width}x${image.height}) do not match mode requirements (${mode.LINE_WIDTH}x${mode.LINE_COUNT}). Output may be distorted.`, true);
        }

        const all_samples: Float32Array[] = [];

        // 2. Generate Header (VOX + VIS)
        all_samples.push(this._generate_header(mode));

        // 3. Encode Lines
        for (let line = 0; line < mode.LINE_COUNT; line++) {
            if (line < image.height) {
                const line_data = this._get_line_data(image, line, mode);
                all_samples.push(this._encode_line(line_data, mode));
            } else {
                // If image is shorter than mode, fill with black
                // TODO: Handle this case if needed
            }
            progress_bar(line, mode.LINE_COUNT - 1, "Encoding image...");
        }
        log_message("...Done!");

        // Concatenate all samples
        const total_length = all_samples.reduce((acc, curr) => acc + curr.length, 0);
        const result = new Float32Array(total_length);
        let offset = 0;
        for (const s of all_samples) {
            result.set(s, offset);
            offset += s.length;
        }

        return result;
    }

    _generate_header(mode: spec.SSTVMode): Float32Array {
        const samples: Float32Array[] = [];

        // VOX tones (optional but good practice: 1900Hz for 100ms, then silence)
        // spec.ts doesn't explicitly define VOX, but it's common. We'll skip for strict spec adherence or add if needed.
        // Let's stick to the calibration header defined in spec.ts constants if possible, or standard VIS sequence.

        // Leader tone: 1900 Hz for 300ms
        samples.push(this._freq_to_samples(1900, 0.3));

        // Break: 1200 Hz for 10ms
        samples.push(this._freq_to_samples(1200, 0.01));

        // Leader: 1900 Hz for 300ms
        samples.push(this._freq_to_samples(1900, 0.3));

        // VIS Start: 1200 Hz for 30ms
        samples.push(this._freq_to_samples(1200, 0.03));

        // VIS Code
        // Find VIS code for mode
        let vis_code = 0;
        for (const [code, m] of Object.entries(spec.VIS_MAP)) {
            if (m === mode) {
                vis_code = parseInt(code);
                break;
            }
        }

        // Add parity bit
        let parity = 0;
        let temp_vis = vis_code;
        while (temp_vis > 0) {
            parity += temp_vis & 1;
            temp_vis >>= 1;
        }
        const parity_bit = (parity % 2 === 0) ? 0 : 1; // Even parity for the 7 bits? 
        // Actually spec says: "The last bit is a parity bit, such that the total number of 1s in the 8 bits is even."
        // So if current 1s is odd, we add 1. If even, we add 0.
        // Wait, decode.ts says: `const parity = vis_bits.reduce((a, b) => a + b, 0) % 2 === 0;`
        // So the SUM of all 8 bits must be even.

        const full_code = vis_code | (parity_bit << 7);

        // Transmit LSB first
        for (let i = 0; i < 8; i++) {
            const bit = (full_code >> i) & 1;
            const freq = bit === 1 ? 1100 : 1300;
            samples.push(this._freq_to_samples(freq, 0.03));
        }

        // Stop bit: 1200 Hz for 30ms
        samples.push(this._freq_to_samples(1200, 0.03));

        return this._concat(samples);
    }

    _encode_line(line_data: Uint8Array[], mode: spec.SSTVMode): Float32Array {
        const samples: Float32Array[] = [];

        // Martin 1 specific logic for now (can be generalized later based on mode props)
        // Martin 1: Sync -> Audio Separator -> Green -> Separator -> Blue -> Separator -> Red -> Separator

        // Sync Pulse: 1200 Hz
        samples.push(this._freq_to_samples(1200, mode.SYNC_PULSE));

        // Sync Porch: 1500 Hz
        samples.push(this._freq_to_samples(1500, mode.SYNC_PORCH));

        // Green Scan
        samples.push(this._encode_scan(line_data[1], mode.SCAN_TIME)); // Green is index 1

        // Separator: 1500 Hz
        samples.push(this._freq_to_samples(1500, mode.SEP_PULSE));

        // Blue Scan
        samples.push(this._encode_scan(line_data[2], mode.SCAN_TIME)); // Blue is index 2

        // Separator: 1500 Hz
        samples.push(this._freq_to_samples(1500, mode.SEP_PULSE));

        // Red Scan
        samples.push(this._encode_scan(line_data[0], mode.SCAN_TIME)); // Red is index 0

        // Separator: 1500 Hz
        samples.push(this._freq_to_samples(1500, mode.SEP_PULSE));

        return this._concat(samples);
    }

    _encode_scan(pixels: Uint8Array, duration: number): Float32Array {
        const num_pixels = pixels.length;
        const samples_per_pixel = (duration * this._sample_rate) / num_pixels;
        const total_samples = Math.round(duration * this._sample_rate);
        const out = new Float32Array(total_samples);

        for (let i = 0; i < total_samples; i++) {
            const pixel_idx = Math.floor(i / samples_per_pixel);
            const val = pixels[Math.min(pixel_idx, num_pixels - 1)];

            // Map 0-255 to 1500-2300 Hz
            const freq = 1500 + (val * 3.1372549);

            this._phase += (2 * Math.PI * freq) / this._sample_rate;
            out[i] = 0.5 * Math.sin(this._phase);
        }

        return out;
    }

    _get_line_data(image: PNG, line: number, mode: spec.SSTVMode): Uint8Array[] {
        const width = mode.LINE_WIDTH;
        const r = new Uint8Array(width);
        const g = new Uint8Array(width);
        const b = new Uint8Array(width);

        for (let x = 0; x < width; x++) {
            if (x < image.width) {
                const idx = (image.width * line + x) << 2;
                r[x] = image.data[idx];
                g[x] = image.data[idx + 1];
                b[x] = image.data[idx + 2];
            }
        }
        return [r, g, b];
    }

    _freq_to_samples(freq: number, duration: number): Float32Array {
        const num_samples = Math.round(duration * this._sample_rate);
        const samples = new Float32Array(num_samples);

        for (let i = 0; i < num_samples; i++) {
            this._phase += (2 * Math.PI * freq) / this._sample_rate;
            samples[i] = 0.5 * Math.sin(this._phase);
        }
        return samples;
    }

    _concat(arrays: Float32Array[]): Float32Array {
        const total_len = arrays.reduce((acc, curr) => acc + curr.length, 0);
        const result = new Float32Array(total_len);
        let offset = 0;
        for (const arr of arrays) {
            result.set(arr, offset);
            offset += arr.length;
        }
        return result;
    }
}
