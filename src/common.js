/**
 * Common utilities for logging and progress
 */

const readline = require('readline');

function log_message(message = "", err = false, recur = false) {
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

function progress_bar(current, total, message = "") {
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

module.exports = {
    log_message,
    progress_bar
};
