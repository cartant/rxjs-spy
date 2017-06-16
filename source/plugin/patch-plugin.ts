/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";
import { Subscriber } from "rxjs/Subscriber";
import { matches } from "../operator/tag";
import { BasePlugin } from "./plugin";
import { isObservable } from "../util";

export class PatchPlugin extends BasePlugin {

    private match_: any;
    private patch_: Observable<any> | ((value: any) => any);

    constructor(observable: Observable<any>, source: Observable<any>);
    constructor(observable: Observable<any>, project: (value: any) => any);
    constructor(observable: Observable<any>, value: any);
    constructor(match: string, source: Observable<any>);
    constructor(match: string, project: (value: any) => any);
    constructor(match: string, value: any);
    constructor(match: RegExp, source: Observable<any>);
    constructor(match: RegExp, project: (value: any) => any);
    constructor(match: RegExp, value: any);
    constructor(match: (tag: string) => boolean, source: Observable<any>);
    constructor(match: (tag: string) => boolean, project: (value: any) => any);
    constructor(match: (tag: string) => boolean, value: any);
    constructor(match: any, arg: any) {

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
