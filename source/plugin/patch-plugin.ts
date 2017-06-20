/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";
import { Subscriber } from "rxjs/Subscriber";
import { Match, matches } from "../operator/tag";
import { BasePlugin } from "./plugin";
import { isObservable } from "../util";

export class PatchPlugin extends BasePlugin {

    private match_: Match;
    private patch_: Observable<any> | ((value: any) => any);

    constructor(match: Match, source: Observable<any>);
    constructor(match: Match, project: (value: any) => any);
    constructor(match: Match, value: any);
    constructor(match: Match, arg: any) {

        super();

        this.match_ = match;
        this.patch_ = ((typeof arg === "function") || isObservable(arg)) ? arg : () => arg;
    }

    patch(observable: Observable<any>, subscriber: Subscriber<any>): Observable<any> | ((value: any) => any) | null {

        const { match_, patch_ } = this;

        if (matches(observable, match_)) {
            return patch_;
        }
        return null;
    }
}
