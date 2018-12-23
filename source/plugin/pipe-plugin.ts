/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { merge, NEVER, Observable } from "rxjs";
import { Match, matches, toString as matchToString } from "../match";
import { Spy } from "../spy-interface";
import { SubscriptionRef } from "../subscription-ref";
import { BasePlugin } from "./plugin";

export class PipePlugin extends BasePlugin {

    private match_: Match;
    private operator_: (source: Observable<any>) => Observable<any>;

    constructor({
        complete = true,
        match,
        operator,
        spy
    }: {
        complete?: boolean,
        match: Match,
        operator: (source: Observable<any>) => Observable<any>,
        spy: Spy
    }) {

        super(`pipe(${matchToString(match)})`);

        this.match_ = match;
        this.operator_ = complete ? operator : source => merge(NEVER, operator(source));
    }

    operator(ref: SubscriptionRef): ((source: Observable<any>) => Observable<any>) | undefined {

        const { match_, operator_: operator_ } = this;

        if (matches(ref, match_)) {
            return operator_;
        }
        return undefined;
    }
}
