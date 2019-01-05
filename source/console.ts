/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { defaultLogger, toLogger } from "./logger";
import { Patcher } from "./patcher";
import { PausePlugin } from "./plugins";

export function forConsole(
    patcher: Patcher,
    deprecation: () => void = () => {}
): any {
    return {
        get limit(): number {
            deprecation();
            return patcher.limit;
        },
        set limit(value: number) {
            deprecation();
            patcher.limit = value;
        },
        deck(call?: number): any {
            deprecation();
            const pausePlugins = patcher.pluginHost.findPlugins(PausePlugin);
            if (call === undefined) {
                const logger = toLogger(defaultLogger);
                logger.group(`${pausePlugins.length} Deck(s)`);
                pausePlugins.forEach((pausePlugin, index) => logger.log(`${index + 1} pause(${pausePlugin.name})`));
                logger.groupEnd();
            } else {
                const pausePlugin = pausePlugins[call - 1];
                return pausePlugin ? pausePlugin.deck : undefined;
            }
        },
        diff(...args: any[]): void {
            deprecation();
            patcher.diff.apply(patcher, args);
        },
        log(...args: any[]): void {
            deprecation();
            patcher.log.apply(patcher, args);
        },
        pause(...args: any[]): any {
            deprecation();
            return patcher.pause.apply(patcher, args);
        },
        pipe(...args: any[]): void {
            deprecation();
            patcher.pipe.apply(patcher, args);
        },
        query(...args: any[]): void {
            deprecation();
            patcher.query.apply(patcher, args);
        },
        stats(): void {
            deprecation();
            patcher.stats();
        },
        undo(...args: any[]): void {
            if (args.length === 0) {
                const logger = toLogger(defaultLogger);
                logger.group(`${patcher.undos.length} undo(s)`);
                patcher.undos.forEach((undo, index) => logger.log(`${index + 1} ${undo.name}`));
                logger.groupEnd();
            } else {
                args
                    .map(at => patcher.undos[at - 1])
                    .filter(Boolean)
                    .forEach(undo => patcher.pluginHost.unplug(undo));
            }
        }
    };
}
