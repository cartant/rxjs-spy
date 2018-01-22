/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";
import { PartialLogger } from "./logger";
import { Auditor } from "./auditor";
import { Match } from "./match";
import { Deck, Notification, Plugin } from "./plugin";

export interface Ctor<T> {
    new (...args: any[]): T;
}

export interface Options {
    [key: string]: any;
}

export interface Teardown {
    (): void;
}

export interface Spy {
    readonly auditor: Auditor;
    readonly tick: number;
    readonly version: string;
    debug(match: Match, ...notifications: Notification[]): Teardown;
    find<T extends Plugin>(ctor: Ctor<T>): T | undefined;
    findAll<T extends Plugin>(ctor: Ctor<T>): T[];
    findAll(): Plugin[];
    flush(): void;
    let(match: Match, select: (source: Observable<any>) => Observable<any>, options?: Options): Teardown;
    log(match: Match, partialLogger?: PartialLogger): Teardown;
    log(partialLogger?: PartialLogger): Teardown;
    pause(match: Match): Deck;
    plug(...plugins: Plugin[]): Teardown;
    show(match: Match, partialLogger?: PartialLogger): void;
    show(partialLogger?: PartialLogger): void;
    stats(partialLogger?: PartialLogger): void;
    teardown(): void;
    unplug(...plugins: Plugin[]): void;
}
