/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";
import { Subscriber } from "rxjs/Subscriber";
import { Match, matches } from "../match";
import { BasePlugin, SubscriptionRef } from "./plugin";

export class LetPlugin extends BasePlugin {

    private match_: Match;
    private select_: (source: Observable<any>) => Observable<any>;

    constructor(match: Match, select: (source: Observable<any>) => Observable<any>) {

        super();

        this.match_ = match;
        this.select_ = select;
    }

    select(ref: SubscriptionRef): ((source: Observable<any>) => Observable<any>) | null {

        const { match_, select_ } = this;
        const { observable } = ref;

        if (matches(observable, match_)) {
            return select_;
        }
        return null;
    }
}
