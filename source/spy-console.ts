/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { detect } from "./detect";
import { defaultLogger, toLogger } from "./logger";
import { PausePlugin } from "./plugin";
import { SpyCore } from "./spy-core";
import { inferPath, inferType } from "./util";

export function wrap(
    core: SpyCore,
    deprecation: () => void = () => {}
): any {

    return {

        deck(call?: number): any {

            deprecation();
            const pausePlugins = core.findAll(PausePlugin);
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

        debug(...args: any[]): void {

            deprecation();
            core.debug.apply(core, args);
        },

        detect(id: string = ""): void {

            deprecation();
            detect(id);
        },

        inferPath,
        inferType,

        let(...args: any[]): void {

            deprecation();
            core.let.apply(core, args);
        },

        log(...args: any[]): void {

            deprecation();
            core.log.apply(core, args);
        },

        maxLogged(...args: any[]): void {

            deprecation();
            core.maxLogged.apply(core, args);
        },

        pause(...args: any[]): any {

            deprecation();
            return core.pause.apply(core, args);
        },

        query(...args: any[]): void {

            deprecation();
            core.query.apply(core, args);
        },

        show(...args: any[]): void {

            deprecation();
            core.show.apply(core, args);
        },

        stats(): void {

            deprecation();
            core.stats();
        },

        undo(...args: any[]): void {

            if (args.length === 0) {
                const logger = toLogger(defaultLogger);
                logger.group(`${core.undos.length} undo(s)`);
                core.undos.forEach((undo, index) => logger.log(`${index + 1} ${undo.name}`));
                logger.groupEnd();
            } else {
                args
                    .map((at) => core.undos[at - 1])
                    .filter(Boolean)
                    .forEach((undo) => core.unplug(undo));
            }
        }
    };
}
