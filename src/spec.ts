/**
 * Constants for SSTV specification and each supported mode
 */

export enum COL_FMT {
    RGB = 1,
    GBR = 2,
    YUV = 3,
    BW = 4
}

export interface SSTVMode {
    NAME: string;
    COLOR?: COL_FMT;
    LINE_WIDTH: number;
    LINE_COUNT: number;
    SCAN_TIME: number;
    SYNC_PULSE: number;
    SYNC_PORCH: number;
    SEP_PULSE: number;
    SEP_PORCH?: number;

    CHAN_COUNT: number;
    CHAN_SYNC?: number;
    CHAN_TIME: number;
    HALF_SCAN_TIME?: number;
    HALF_CHAN_TIME?: number;

    CHAN_OFFSETS: number[];

    LINE_TIME: number;
    PIXEL_TIME: number;
    HALF_PIXEL_TIME?: number;
    WINDOW_FACTOR: number;

    HAS_START_SYNC: boolean;
    HAS_HALF_SCAN: boolean;
    HAS_ALT_SCAN: boolean;
}

export class M1 {
    static get NAME() { return "Martin 1"; }
    static get COLOR() { return COL_FMT.GBR; }
    static get LINE_WIDTH() { return 320; }
    static get LINE_COUNT() { return 256; }
    static get SCAN_TIME() { return 0.146432; }
    static get SYNC_PULSE() { return 0.004862; }
    static get SYNC_PORCH() { return 0.000572; }
    static get SEP_PULSE() { return 0.000572; }

    static get CHAN_COUNT() { return 3; }
    static get CHAN_SYNC() { return 0; }
    static get CHAN_TIME() { return this.SEP_PULSE + this.SCAN_TIME; }

    static get CHAN_OFFSETS() {
        const offsets = [this.SYNC_PULSE + this.SYNC_PORCH];
        offsets.push(offsets[0] + this.CHAN_TIME);
        offsets.push(offsets[1] + this.CHAN_TIME);
        return offsets;
    }

    static get LINE_TIME() { return this.SYNC_PULSE + this.SYNC_PORCH + 3 * this.CHAN_TIME; }
    static get PIXEL_TIME() { return this.SCAN_TIME / this.LINE_WIDTH; }
    static get WINDOW_FACTOR() { return 2.34; }

    static get HAS_START_SYNC() { return false; }
    static get HAS_HALF_SCAN() { return false; }
    static get HAS_ALT_SCAN() { return false; }
}

export class M2 extends M1 {
    static get NAME() { return "Martin 2"; }
    static get LINE_WIDTH() { return 320; }
    static get SCAN_TIME() { return 0.073216; }
    static get SYNC_PULSE() { return 0.004862; }
    static get SYNC_PORCH() { return 0.000572; }
    static get SEP_PULSE() { return 0.000572; }

    static get CHAN_TIME() { return this.SEP_PULSE + this.SCAN_TIME; }

    static get CHAN_OFFSETS() {
        const offsets = [this.SYNC_PULSE + this.SYNC_PORCH];
        offsets.push(offsets[0] + this.CHAN_TIME);
        offsets.push(offsets[1] + this.CHAN_TIME);
        return offsets;
    }

    static get LINE_TIME() { return this.SYNC_PULSE + this.SYNC_PORCH + 3 * this.CHAN_TIME; }
    static get PIXEL_TIME() { return this.SCAN_TIME / this.LINE_WIDTH; }
    static get WINDOW_FACTOR() { return 4.68; }
}

export class S1 {
    static get NAME() { return "Scottie 1"; }
    static get COLOR() { return COL_FMT.GBR; }
    static get LINE_WIDTH() { return 320; }
    static get LINE_COUNT() { return 256; }
    static get SCAN_TIME() { return 0.138240; }
    static get SYNC_PULSE() { return 0.009000; }
    static get SYNC_PORCH() { return 0.001500; }
    static get SEP_PULSE() { return 0.001500; }

    static get CHAN_COUNT() { return 3; }
    static get CHAN_SYNC() { return 2; }
    static get CHAN_TIME() { return this.SEP_PULSE + this.SCAN_TIME; }

    static get CHAN_OFFSETS() {
        const offsets = [this.SYNC_PULSE + this.SYNC_PORCH + this.CHAN_TIME];
        offsets.push(offsets[0] + this.CHAN_TIME);
        offsets.push(this.SYNC_PULSE + this.SYNC_PORCH);
        return offsets;
    }

    static get LINE_TIME() { return this.SYNC_PULSE + 3 * this.CHAN_TIME; }
    static get PIXEL_TIME() { return this.SCAN_TIME / this.LINE_WIDTH; }
    static get WINDOW_FACTOR() { return 2.48; }

    static get HAS_START_SYNC() { return true; }
    static get HAS_HALF_SCAN() { return false; }
    static get HAS_ALT_SCAN() { return false; }
}

export class S2 extends S1 {
    static get NAME() { return "Scottie 2"; }
    static get LINE_WIDTH() { return 320; }
    static get SCAN_TIME() { return 0.088064; }
    static get SYNC_PULSE() { return 0.009000; }
    static get SYNC_PORCH() { return 0.001500; }
    static get SEP_PULSE() { return 0.001500; }

    static get CHAN_TIME() { return this.SEP_PULSE + this.SCAN_TIME; }

    static get CHAN_OFFSETS() {
        const offsets = [this.SYNC_PULSE + this.SYNC_PORCH + this.CHAN_TIME];
        offsets.push(offsets[0] + this.CHAN_TIME);
        offsets.push(this.SYNC_PULSE + this.SYNC_PORCH);
        return offsets;
    }

    static get LINE_TIME() { return this.SYNC_PULSE + 3 * this.CHAN_TIME; }
    static get PIXEL_TIME() { return this.SCAN_TIME / this.LINE_WIDTH; }
    static get WINDOW_FACTOR() { return 3.82; }
}

export class SDX extends S2 {
    static get NAME() { return "Scottie DX"; }
    static get LINE_WIDTH() { return 320; }
    static get SCAN_TIME() { return 0.345600; }
    static get SYNC_PULSE() { return 0.009000; }
    static get SYNC_PORCH() { return 0.001500; }
    static get SEP_PULSE() { return 0.001500; }

    static get CHAN_TIME() { return this.SEP_PULSE + this.SCAN_TIME; }

    static get CHAN_OFFSETS() {
        const offsets = [this.SYNC_PULSE + this.SYNC_PORCH + this.CHAN_TIME];
        offsets.push(offsets[0] + this.CHAN_TIME);
        offsets.push(this.SYNC_PULSE + this.SYNC_PORCH);
        return offsets;
    }

    static get LINE_TIME() { return this.SYNC_PULSE + 3 * this.CHAN_TIME; }
    static get PIXEL_TIME() { return this.SCAN_TIME / this.LINE_WIDTH; }
    static get WINDOW_FACTOR() { return 0.98; }
}

export class R36 {
    static get NAME() { return "Robot 36"; }
    static get COLOR() { return COL_FMT.YUV; }
    static get LINE_WIDTH() { return 320; }
    static get LINE_COUNT() { return 240; }
    static get SCAN_TIME() { return 0.088000; }
    static get HALF_SCAN_TIME() { return 0.044000; }
    static get SYNC_PULSE() { return 0.009000; }
    static get SYNC_PORCH() { return 0.003000; }
    static get SEP_PULSE() { return 0.004500; }
    static get SEP_PORCH() { return 0.001500; }

    static get CHAN_COUNT() { return 2; }
    static get CHAN_SYNC() { return 0; }
    static get CHAN_TIME() { return this.SEP_PULSE + this.SCAN_TIME; }

    static get CHAN_OFFSETS() {
        const offsets = [this.SYNC_PULSE + this.SYNC_PORCH];
        offsets.push(offsets[0] + this.CHAN_TIME + this.SEP_PORCH);
        return offsets;
    }

    static get LINE_TIME() { return this.CHAN_OFFSETS[1] + this.HALF_SCAN_TIME; }
    static get PIXEL_TIME() { return this.SCAN_TIME / this.LINE_WIDTH; }
    static get HALF_PIXEL_TIME() { return this.HALF_SCAN_TIME / this.LINE_WIDTH; }
    static get WINDOW_FACTOR() { return 7.70; }

    static get HAS_START_SYNC() { return false; }
    static get HAS_HALF_SCAN() { return true; }
    static get HAS_ALT_SCAN() { return true; }
}

export class R72 extends R36 {
    static get NAME() { return "Robot 72"; }
    static get LINE_WIDTH() { return 320; }
    static get SCAN_TIME() { return 0.138000; }
    static get HALF_SCAN_TIME() { return 0.069000; }
    static get SYNC_PULSE() { return 0.009000; }
    static get SYNC_PORCH() { return 0.003000; }
    static get SEP_PULSE() { return 0.004500; }
    static get SEP_PORCH() { return 0.001500; }

    static get CHAN_COUNT() { return 3; }
    static get CHAN_TIME() { return this.SEP_PULSE + this.SCAN_TIME; }
    static get HALF_CHAN_TIME() { return this.SEP_PULSE + this.HALF_SCAN_TIME; }

    static get CHAN_OFFSETS() {
        const offsets = [this.SYNC_PULSE + this.SYNC_PORCH];
        offsets.push(offsets[0] + this.CHAN_TIME + this.SEP_PORCH);
        offsets.push(offsets[1] + this.HALF_CHAN_TIME + this.SEP_PORCH);
        return offsets;
    }

    static get LINE_TIME() { return this.CHAN_OFFSETS[2] + this.HALF_SCAN_TIME; }
    static get PIXEL_TIME() { return this.SCAN_TIME / this.LINE_WIDTH; }
    static get HALF_PIXEL_TIME() { return this.HALF_SCAN_TIME / this.LINE_WIDTH; }
    static get WINDOW_FACTOR() { return 4.88; }

    static get HAS_ALT_SCAN() { return false; }
}

export const VIS_MAP: { [key: number]: any } = {
    8: R36,
    12: R72,
    40: M2,
    44: M1,
    56: S2,
    60: S1,
    76: SDX
};

export const BREAK_OFFSET = 0.300;
export const LEADER_OFFSET = 0.010 + BREAK_OFFSET;
export const VIS_START_OFFSET = 0.300 + LEADER_OFFSET;

export const HDR_SIZE = 0.030 + VIS_START_OFFSET;
export const HDR_WINDOW_SIZE = 0.010;

export const VIS_BIT_SIZE = 0.030;
