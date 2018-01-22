/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-console no-invalid-this*/

export interface PartialLogger {
    readonly error?: (message?: any, ...args: any[]) => void;
    readonly group?: (title?: string) => void;
    readonly groupCollapsed?: (title?: string) => void;
    readonly groupEnd?: () => void;
    readonly log: (message?: any, ...args: any[]) => void;
    readonly warn?: (message?: any, ...args: any[]) => void;
}

export interface Logger extends PartialLogger {
    readonly error: (message?: any, ...args: any[]) => void;
    readonly group: (title?: string) => void;
    readonly groupCollapsed: (title?: string) => void;
    readonly groupEnd: () => void;
    readonly log: (message?: any, ...args: any[]) => void;
    readonly warn: (message?: any, ...args: any[]) => void;
}

export const defaultLogger = console;

export function toLogger(partialLogger: PartialLogger): Logger {

    if (partialLogger.error &&
        partialLogger.group &&
        partialLogger.groupCollapsed &&
        partialLogger.groupEnd &&
        partialLogger.warn) {

        return partialLogger as Logger;
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
        }
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
