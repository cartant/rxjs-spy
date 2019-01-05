/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { defaultLogger, toLogger } from "./logger";
import { PausePlugin } from "./plugin";
import { Spy } from "./spy";

export function forConsole(
    spy: Spy,
    deprecation: () => void = () => {}
): any {
    return {
        get limit(): number {
            deprecation();
            return spy.limit;
        },
        set limit(value: number) {
            deprecation();
            spy.limit = value;
        },
        deck(call?: number): any {
            deprecation();
            const pausePlugins = spy.pluginHost.findPlugins(PausePlugin);
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
            spy.diff.apply(spy, args);
        },
        log(...args: any[]): void {
            deprecation();
            spy.log.apply(spy, args);
        },
        pause(...args: any[]): any {
            deprecation();
            return spy.pause.apply(spy, args);
        },
        pipe(...args: any[]): void {
            deprecation();
            spy.pipe.apply(spy, args);
        },
        query(...args: any[]): void {
            deprecation();
            spy.query.apply(spy, args);
        },
        stats(): void {
            deprecation();
            spy.stats();
        },
        undo(...args: any[]): void {
            if (args.length === 0) {
                const logger = toLogger(defaultLogger);
                logger.group(`${spy.undos.length} undo(s)`);
                spy.undos.forEach((undo, index) => logger.log(`${index + 1} ${undo.name}`));
                logger.groupEnd();
            } else {
                args
                    .map(at => spy.undos[at - 1])
                    .filter(Boolean)
                    .forEach(undo => spy.pluginHost.unplug(undo));
            }
        }
    };
}
