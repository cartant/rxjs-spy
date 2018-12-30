/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs";
import { Auditor } from "./auditor";
import { Logger, PartialLogger } from "./logger";
import { Match } from "./match";
import { Deck, Plugin, PluginCtor, PluginOptions } from "./plugin";
import { QueryDerivations, QueryPredicate } from "./query";
import { Teardown } from "./teardown";

export interface Spy {
    readonly auditor: Auditor;
    readonly logger: Logger;
    readonly tick: number;
    readonly version: string;
    find<P extends Plugin, O extends PluginOptions>(ctor: PluginCtor<P, O>): P[];
    log(observableMatch: Match, notificationMatch: Match, partialLogger?: PartialLogger): Teardown;
    log(observableMatch: Match, partialLogger?: PartialLogger): Teardown;
    log(partialLogger?: PartialLogger): Teardown;
    pause(match: Match): Deck;
    pipe(match: Match, operator: (source: Observable<any>) => Observable<any>, complete?: boolean): Teardown;
    plug(...plugins: Plugin[]): Teardown;
    query(predicate: string | QueryPredicate, partialLogger?: PartialLogger): void;
    query(derivations: QueryDerivations): void;
    show(match: Match, partialLogger?: PartialLogger): void;
    show(partialLogger?: PartialLogger): void;
    stats(partialLogger?: PartialLogger): void;
    teardown(): void;
    unplug(...plugins: Plugin[]): void;
}
