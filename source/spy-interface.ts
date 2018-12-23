/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs";
import { Auditor } from "./auditor";
import { Logger, PartialLogger } from "./logger";
import { Match } from "./match";
import { Deck, Notification, Plugin, PluginCtor, PluginOptions } from "./plugin";

export interface Options {
    [key: string]: any;
}

export interface Teardown {
    (): void;
}

export interface Spy {
    readonly auditor: Auditor;
    readonly logger: Logger;
    readonly tick: number;
    readonly version: string;
    debug(match: Match, ...notifications: Notification[]): Teardown;
    find<P extends Plugin, O extends PluginOptions>(ctor: PluginCtor<P, O>): P | undefined;
    findAll<P extends Plugin, O extends PluginOptions>(ctor: PluginCtor<P, O>): P[];
    findAll(): Plugin[];
    log(observableMatch: Match, notificationMatch: Match, partialLogger?: PartialLogger): Teardown;
    log(observableMatch: Match, partialLogger?: PartialLogger): Teardown;
    log(partialLogger?: PartialLogger): Teardown;
    pause(match: Match): Deck;
    pipe({
        complete,
        match,
        operator
    }: {
        complete?: boolean
        match: Match,
        operator: (source: Observable<any>) => Observable<any>
    }): Teardown;
    plug(...plugins: Plugin[]): Teardown;
    show(match: Match, partialLogger?: PartialLogger): void;
    show(partialLogger?: PartialLogger): void;
    stats(partialLogger?: PartialLogger): void;
    teardown(): void;
    unplug(...plugins: Plugin[]): void;
}
