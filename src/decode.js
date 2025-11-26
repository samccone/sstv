/**
 * Class and methods to decode SSTV signal
 */

const fs = require('fs');
const FFT = require('fft.js');
const { PNG } = require('pngjs');
const spec = require('./spec');
const { log_message, progress_bar } = require('./common');

function calc_lum(freq) {
    const lum = Math.round((freq - 1500) / 3.1372549);
    return Math.min(Math.max(lum, 0), 255);
}

function barycentric_peak_interp(bins, x) {
    const y1 = x <= 0 ? bins[x] : bins[x - 1];
    const y3 = x + 1 >= bins.length ? bins[x] : bins[x + 1];

    const denom = y3 + bins[x] + y1;
    if (denom === 0) return 0;

    return (y3 - y1) / denom + x;
}

function hann(length) {
    const window = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (length - 1)));
    }
    return window;
}

class SSTVDecoder {
    constructor(samples, sampleRate) {
        this.mode = null;
        this._samples = samples;
        this._sample_rate = sampleRate;
    }

    decode(skip = 0.0) {
        if (skip > 0.0) {
            const skipSamples = Math.round(skip * this._sample_rate);
            this._samples = this._samples.slice(skipSamples);
        }

        const header_end = this._find_header();

        if (header_end === null) {
            return null;
        }

        this.mode = this._decode_vis(header_end);

        const vis_end = header_end + Math.round(spec.VIS_BIT_SIZE * 9 * this._sample_rate);

        const image_data = this._decode_image_data(vis_end);

        return this._draw_image(image_data);
    }

    _peak_fft_freq(data) {
        const len = data.length;
        // FFT size should be power of 2, usually next power of 2 or just len if it is power of 2
        // But fft.js requires power of 2.
        // The python code uses rfft on the exact length.
        // We might need to zero pad or truncate.
        // Ideally we want high resolution.
        // Let's use next power of 2.
        let n = 1;
        while (n < len) n *= 2;

        const f = new FFT(n);
        const input = new Array(n).fill(0);
        const window = hann(len);

        for (let i = 0; i < len; i++) {
            input[i] = data[i] * window[i];
        }

        const out = f.createComplexArray();
        f.realTransform(out, input);
        // f.completeSpectrum(out); // Not strictly needed for magnitude of first half

        const magnitudes = new Float32Array(n / 2 + 1);
        for (let i = 0; i < n / 2 + 1; i++) {
            const r = out[2 * i];
            const i_val = out[2 * i + 1];
            magnitudes[i] = Math.sqrt(r * r + i_val * i_val);
        }

        let max_mag = -1;
        let x = 0;
        for (let i = 0; i < magnitudes.length; i++) {
            if (magnitudes[i] > max_mag) {
                max_mag = magnitudes[i];
                x = i;
            }
        }

        const peak = barycentric_peak_interp(magnitudes, x);

        // Frequency resolution is sample_rate / n
        return peak * this._sample_rate / n;
    }

    _find_header() {
        const header_size = Math.round(spec.HDR_SIZE * this._sample_rate);
        const window_size = Math.round(spec.HDR_WINDOW_SIZE * this._sample_rate);

        const leader_1_sample = 0;
        const leader_1_search = leader_1_sample + window_size;

        const break_sample = Math.round(spec.BREAK_OFFSET * this._sample_rate);
        const break_search = break_sample + window_size;

        const leader_2_sample = Math.round(spec.LEADER_OFFSET * this._sample_rate);
        const leader_2_search = leader_2_sample + window_size;

        const vis_start_sample = Math.round(spec.VIS_START_OFFSET * this._sample_rate);
        const vis_start_search = vis_start_sample + window_size;

        const jump_size = Math.round(0.002 * this._sample_rate);

        for (let current_sample = 0; current_sample < this._samples.length - header_size; current_sample += jump_size) {
            if (current_sample % (jump_size * 256) === 0) {
                const progress = current_sample / this._sample_rate;
                log_message(`Searching for calibration header... ${progress.toFixed(1)}s`, false, true);
            }

            const search_end = current_sample + header_size;
            const search_area = this._samples.slice(current_sample, search_end);

            const leader_1_area = search_area.slice(leader_1_sample, leader_1_search);
            const break_area = search_area.slice(break_sample, break_search);
            const leader_2_area = search_area.slice(leader_2_sample, leader_2_search);
            const vis_start_area = search_area.slice(vis_start_sample, vis_start_search);

            if (Math.abs(this._peak_fft_freq(leader_1_area) - 1900) < 50 &&
                Math.abs(this._peak_fft_freq(break_area) - 1200) < 50 &&
                Math.abs(this._peak_fft_freq(leader_2_area) - 1900) < 50 &&
                Math.abs(this._peak_fft_freq(vis_start_area) - 1200) < 50) {

                log_message("Searching for calibration header... Found!    ", false, false);
                return current_sample + header_size;
            }
        }

        log_message("", false, false);
        log_message("Couldn't find SSTV header in the given audio file", true);
        return null;
    }

    _decode_vis(vis_start) {
        const bit_size = Math.round(spec.VIS_BIT_SIZE * this._sample_rate);
        const vis_bits = [];

        for (let bit_idx = 0; bit_idx < 8; bit_idx++) {
            const bit_offset = vis_start + bit_idx * bit_size;
            const section = this._samples.slice(bit_offset, bit_offset + bit_size);
            const freq = this._peak_fft_freq(section);
            vis_bits.push(freq <= 1200 ? 1 : 0);
        }

        const parity = vis_bits.reduce((a, b) => a + b, 0) % 2 === 0;
        if (!parity) {
            throw new Error("Error decoding VIS header (invalid parity bit)");
        }

        let vis_value = 0;
        // Python: vis_bits[-2::-1] -> slice from second to last down to start, reversed
        // JS: slice(0, 7).reverse()
        const bits_to_process = vis_bits.slice(0, 7).reverse();
        for (const bit of bits_to_process) {
            vis_value = (vis_value << 1) | bit;
        }

        if (!spec.VIS_MAP[vis_value]) {
            throw new Error(`SSTV mode is unsupported (VIS: ${vis_value})`);
        }

        const mode = spec.VIS_MAP[vis_value];
        log_message(`Detected SSTV mode ${mode.NAME}`);

        return mode;
    }

    _align_sync(align_start, start_of_sync = true) {
        const sync_window = Math.round(this.mode.SYNC_PULSE * 1.4 * this._sample_rate);
        const align_stop = this._samples.length - sync_window;

        if (align_stop <= align_start) {
            return null;
        }

        let current_sample;
        for (current_sample = align_start; current_sample < align_stop; current_sample++) {
            const section_end = current_sample + sync_window;
            const search_section = this._samples.slice(current_sample, section_end);

            if (this._peak_fft_freq(search_section) > 1350) {
                break;
            }
        }

        const end_sync = current_sample + Math.floor(sync_window / 2);

        if (start_of_sync) {
            return end_sync - Math.round(this.mode.SYNC_PULSE * this._sample_rate);
        } else {
            return end_sync;
        }
    }

    _decode_image_data(image_start) {
        const window_factor = this.mode.WINDOW_FACTOR;
        let centre_window_time = (this.mode.PIXEL_TIME * window_factor) / 2;
        let pixel_window = Math.round(centre_window_time * 2 * this._sample_rate);

        const height = this.mode.LINE_COUNT;
        const channels = this.mode.CHAN_COUNT;
        const width = this.mode.LINE_WIDTH;

        const image_data = new Array(height).fill(0).map(() =>
            new Array(channels).fill(0).map(() =>
                new Array(width).fill(0)
            )
        );

        let seq_start = image_start;
        if (this.mode.HAS_START_SYNC) {
            seq_start = this._align_sync(image_start, false);
            if (seq_start === null) {
                throw new Error("Reached end of audio before image data");
            }
        }

        for (let line = 0; line < height; line++) {
            if (this.mode.CHAN_SYNC > 0 && line === 0) {
                const sync_offset = this.mode.CHAN_OFFSETS[this.mode.CHAN_SYNC];
                seq_start -= Math.round((sync_offset + this.mode.SCAN_TIME) * this._sample_rate);
            }

            for (let chan = 0; chan < channels; chan++) {
                if (chan === this.mode.CHAN_SYNC) {
                    if (line > 0 || chan > 0) {
                        seq_start += Math.round(this.mode.LINE_TIME * this._sample_rate);
                    }

                    seq_start = this._align_sync(seq_start);
                    if (seq_start === null) {
                        log_message();
                        log_message("Reached end of audio whilst decoding.");
                        return image_data;
                    }
                }

                let pixel_time = this.mode.PIXEL_TIME;
                if (this.mode.HAS_HALF_SCAN) {
                    if (chan > 0) {
                        pixel_time = this.mode.HALF_PIXEL_TIME;
                    }
                    centre_window_time = (pixel_time * window_factor) / 2;
                    pixel_window = Math.round(centre_window_time * 2 * this._sample_rate);
                }

                for (let px = 0; px < width; px++) {
                    const chan_offset = this.mode.CHAN_OFFSETS[chan];
                    const px_pos = Math.round(seq_start + (chan_offset + px * pixel_time - centre_window_time) * this._sample_rate);
                    const px_end = px_pos + pixel_window;

                    if (px_end >= this._samples.length) {
                        log_message();
                        log_message("Reached end of audio whilst decoding.");
                        return image_data;
                    }

                    const pixel_area = this._samples.slice(px_pos, px_end);
                    const freq = this._peak_fft_freq(pixel_area);

                    image_data[line][chan][px] = calc_lum(freq);
                }
            }
            progress_bar(line, height - 1, "Decoding image...");
        }

        return image_data;
    }

    _draw_image(image_data) {
        const width = this.mode.LINE_WIDTH;
        const height = this.mode.LINE_COUNT;
        const channels = this.mode.CHAN_COUNT;

        const png = new PNG({ width, height });

        log_message("Drawing image data...");

        for (let y = 0; y < height; y++) {
            const odd_line = y % 2;
            for (let x = 0; x < width; x++) {
                let r = 0, g = 0, b = 0;

                if (channels === 2) {
                    if (this.mode.HAS_ALT_SCAN) {
                        // R36
                        // YUV
                        const Y = image_data[y][0][x];
                        const U = image_data[y - (odd_line - 1)][1][x]; // This index logic might need checking
                        // In Python: image_data[y-(odd_line-1)][1][x]
                        // if y=0 (even), odd_line=0. y-(-1) = 1. 
                        // if y=1 (odd), odd_line=1. y-0 = 1.
                        // Wait, let's trace Python logic carefully.
                        // R36:
                        // Line 0 (even): Y scan, then odd line color difference (R-Y, B-Y)
                        // Actually R36/R72 send Y every line, but R-Y and B-Y alternate lines.
                        // The python code:
                        // pixel = (image_data[y][0][x], image_data[y-(odd_line-1)][1][x], image_data[y-odd_line][1][x])
                        // This seems to be constructing a tuple (Y, U, V) or similar.
                        // But wait, the Python code says:
                        // if self.mode.COLOR == spec.COL_FMT.YUV:
                        // pixel = (image_data[y][0][x], image_data[y-(odd_line-1)][1][x], image_data[y-odd_line][1][x])
                        // It seems to be fetching Y from channel 0.
                        // And the other two components from channel 1, but from different lines?
                        // Actually channel 1 in R36 contains the chroma signal.
                        // Let's just copy the logic exactly.

                        // JS arrays don't support negative indexing like Python if it goes out of bounds, but here it seems to rely on specific structure.
                        // However, `y-(odd_line-1)`: if y=0, odd_line=0 -> 0 - (-1) = 1.
                        // if y=1, odd_line=1 -> 1 - 0 = 1.
                        // So for y=0 and y=1, it uses index 1.
                        // `y-odd_line`: if y=0 -> 0. if y=1 -> 0.
                        // So for y=0 and y=1, it uses index 0.
                        // But wait, `image_data` is `[line][channel][pixel]`.
                        // So `image_data[1][1][x]` vs `image_data[0][1][x]`.

                        // I will trust the Python logic and replicate the index calculation.
                        // But I need to be careful about array bounds if y is at edges.
                        // In R36, line count is 240.

                        const idx1 = y - (odd_line - 1);
                        const idx2 = y - odd_line;

                        // Safety check
                        const val1 = (idx1 >= 0 && idx1 < height) ? image_data[idx1][1][x] : 128;
                        const val2 = (idx2 >= 0 && idx2 < height) ? image_data[idx2][1][x] : 128;

                        // YUV to RGB conversion needed?
                        // Python: "Let PIL do YUV-RGB conversion for us"
                        // Here I have to do it manually.
                        // Y = image_data[y][0][x]
                        // U (Cb) and V (Cr) are the other two.
                        // In Python code: `pixel = (Y, U, V)` (assuming order)
                        // R36 uses Y, R-Y, B-Y.
                        // Let's assume standard YCbCr conversion if PIL uses "YCbCr".

                        const Y_val = image_data[y][0][x];
                        const U_val = val1;
                        const V_val = val2;

                        // Convert YCbCr to RGB
                        // R = Y + 1.402 * (V - 128)
                        // G = Y - 0.344136 * (U - 128) - 0.714136 * (V - 128)
                        // B = Y + 1.772 * (U - 128)

                        r = Y_val + 1.402 * (V_val - 128);
                        g = Y_val - 0.344136 * (U_val - 128) - 0.714136 * (V_val - 128);
                        b = Y_val + 1.772 * (U_val - 128);
                    }
                } else if (channels === 3) {
                    if (this.mode.COLOR === spec.COL_FMT.GBR) {
                        // M1, M2, S1, S2, SDX
                        // Python: (image_data[y][2][x], image_data[y][0][x], image_data[y][1][x])
                        // So R=ch2, G=ch0, B=ch1
                        r = image_data[y][2][x];
                        g = image_data[y][0][x];
                        b = image_data[y][1][x];
                    } else if (this.mode.COLOR === spec.COL_FMT.YUV) {
                        // R72
                        // Python: (image_data[y][0][x], image_data[y][2][x], image_data[y][1][x])
                        // Y=ch0, U=ch2, V=ch1 (Assuming PIL YCbCr order)
                        const Y_val = image_data[y][0][x];
                        const U_val = image_data[y][2][x];
                        const V_val = image_data[y][1][x];

                        r = Y_val + 1.402 * (V_val - 128);
                        g = Y_val - 0.344136 * (U_val - 128) - 0.714136 * (V_val - 128);
                        b = Y_val + 1.772 * (U_val - 128);
                    } else if (this.mode.COLOR === spec.COL_FMT.RGB) {
                        r = image_data[y][0][x];
                        g = image_data[y][1][x];
                        b = image_data[y][2][x];
                    }
                }

                const idx = (width * y + x) << 2;
                png.data[idx] = Math.min(Math.max(Math.round(r), 0), 255);
                png.data[idx + 1] = Math.min(Math.max(Math.round(g), 0), 255);
                png.data[idx + 2] = Math.min(Math.max(Math.round(b), 0), 255);
                png.data[idx + 3] = 255; // Alpha
            }
        }

        log_message("...Done!");
        return png;
    }
}

module.exports = SSTVDecoder;
