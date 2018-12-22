/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-console no-invalid-this*/

// This file is named `spy.ts` instead of `logger.ts` because this file's name
// is written to the console in Chrome - just after each message - so it might
// as well be a name that's specific to the tool itself.

export interface PartialLogger {
    readonly error?: (message?: any, ...args: any[]) => void;
    readonly group?: (title?: string) => void;
    readonly groupCollapsed?: (title?: string) => void;
    readonly groupEnd?: () => void;
    readonly log: (message?: any, ...args: any[]) => void;
    readonly warn?: (message?: any, ...args: any[]) => void;
    readonly warnOnce?: (message?: any, ...args: any[]) => void;
}

export interface Logger extends PartialLogger {
    readonly error: (message?: any, ...args: any[]) => void;
    readonly group: (title?: string) => void;
    readonly groupCollapsed: (title?: string) => void;
    readonly groupEnd: () => void;
    readonly log: (message?: any, ...args: any[]) => void;
    readonly warn: (message?: any, ...args: any[]) => void;
    readonly warnOnce: (message?: any, ...args: any[]) => void;
}

export const defaultLogger = toLogger(console);

export function toLogger(partialLogger: PartialLogger): Logger {

    if (partialLogger.warnOnce) {
        return partialLogger as Logger;
    }

    if (partialLogger.error &&
        partialLogger.group &&
        partialLogger.groupCollapsed &&
        partialLogger.groupEnd &&
        partialLogger.log &&
        partialLogger.warn) {

        const logger = partialLogger as Logger;
        return {
            error(...args: any[]): void { logger.error(...args); },
            group(...args: any[]): void { logger.group(...args); },
            groupCollapsed(...args: any[]): void { logger.groupCollapsed(...args); },
            groupEnd(): void { logger.groupEnd(); },
            log(...args: any[]): void { logger.log(...args); },
            warn(...args: any[]): void { logger.warn(...args); },
            warnOnce
        };
    }

    const spaces = 2;
    let indent = 0;

    return {
        error(message?: any, ...args: any[]): void {
            call("error", message, ...args);
        },
        group(title?: string): void {
            call("log", title);
            indent += spaces;
        },
        groupCollapsed(title?: string): void {
            call("log", title);
            indent += spaces;
        },
        groupEnd(): void {
            indent = Math.max(0, indent - spaces);
        },
        log(message?: any, ...args: any[]): void {
            call("log", message, ...args);
        },
        warn(message?: any, ...args: any[]): void {
            call("warn", message, ...args);
        },
        warnOnce
    };

    function call(method: string, message?: any, ...args: any[]): void {
        const padding = " ".repeat(indent);
        if (message) {
            message = padding + message;
        } else {
            message = padding;
        }
        (partialLogger[method] || partialLogger.log).call(partialLogger, message, ...args);
    }
}

const warnedSymbol = Symbol("warned");
function warnOnce(this: any, message?: any, ...args: any[]): void {
    let warned: { [key: string]: boolean } = this[warnedSymbol];
    if (!warned) {
        warned = this[warnedSymbol] = {};
    }
    if (!warned[message]) {
        this.warn(message, ...args);
        warned[message] = true;
    }
}
