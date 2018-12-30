/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { merge, NEVER, Observable, Subscription } from "rxjs";
import { Match, matches, toString as matchToString } from "../match";
import { BasePlugin, PluginHost } from "./plugin";

export class PipePlugin extends BasePlugin {

    private match_: Match;
    private operator_: (source: Observable<any>) => Observable<any>;

    constructor({
        complete = true,
        match,
        operator,
        pluginHost
    }: {
        complete?: boolean,
        match: Match,
        operator: (source: Observable<any>) => Observable<any>,
        pluginHost: PluginHost
    }) {

        super(`pipe(${matchToString(match)})`);

        this.match_ = match;
        this.operator_ = complete ? operator : source => merge(NEVER, operator(source));
    }

    operator(subscription: Subscription): ((source: Observable<any>) => Observable<any>) | undefined {

        const { match_, operator_: operator_ } = this;

        if (matches(subscription, match_)) {
            return operator_;
        }
        return undefined;
    }
}
