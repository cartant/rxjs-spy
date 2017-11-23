/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { detect } from "./detect";
import { defaultLogger, toLogger } from "./logger";
import { PausePlugin } from "./plugin";
import { SpyCore } from "./spy-core";

export class SpyConsole {

    constructor(private core_: SpyCore) {
    }

    deck(call?: number): any {

        const pausePlugins = this.core_.findAll(PausePlugin);
        if (call === undefined) {
            const logger = toLogger(defaultLogger);
            logger.group(`${pausePlugins.length} Deck(s)`);
            pausePlugins.forEach((pausePlugin, index) => {
                logger.log(`${index + 1} pause(${pausePlugin.name})`);
            });
            logger.groupEnd();
        } else {
            const pausePlugin = pausePlugins[call - 1];
            return pausePlugin ? pausePlugin.deck : null;
        }
    }

    debug(...args: any[]): void {

        this.core_.debug.apply(null, args);
    }

    detect(id: string = ""): void {

        detect(id);
    }

    flush(): void {

        this.core_.flush();
    }

    let(...args: any[]): void {

        this.core_.let.apply(null, args);
    }

    log(...args: any[]): void {

        this.core_.log.apply(null, args);
    }

    pause(...args: any[]): any {

        return this.core_.pause.apply(null, args);
    }

    show(...args: any[]): void {

        this.core_.show.apply(null, args);
    }

    stats(): void {

        this.core_.stats();
    }

    undo(...args: any[]): void {

        if (args.length === 0) {
            const logger = toLogger(defaultLogger);
            logger.group(`${this.core_.undos.length} undo(s)`);
            this.core_.undos.forEach((undo, index) => {
                logger.log(`${index + 1} ${undo.name}`);
            });
            logger.groupEnd();
        } else {
            args
                .map((at) => this.core_.undos[at - 1])
                .forEach((undo) => { if (undo) { undo.teardown(); } });
        }
    }
}
