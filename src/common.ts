/**
 * Common utilities for logging and progress
 */

export function log_message(message: string = "", err: boolean = false, recur: boolean = false): void {
    if (recur) {
        process.stdout.write(`\r${message}`);
    } else {
        if (err) {
            console.error(message);
        } else {
            console.log(message);
        }
    }
}

export function progress_bar(current: number, total: number, message: string = ""): void {
    const width = 30;
    const percent = current / total;
    const filled = Math.round(width * percent);
    const empty = width - filled;

    const bar = '█'.repeat(filled) + '-'.repeat(empty);
    const percentStr = Math.round(percent * 100);

    process.stdout.write(`\r${message} [${bar}] ${percentStr}%`);
    if (current === total) {
        process.stdout.write('\n');
    }
}
