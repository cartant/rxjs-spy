/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";
import { Subscriber } from "rxjs/Subscriber";
import { tagged } from "./operator/tag";
import { emptyPlugin, Plugin } from "./plugin";
import { attach, detach } from "./spy";

export class Overrider {

    private match_: any;
    private observableOverride_: (observable: Observable<any>) => Observable<any>;
    private plugin_: Plugin;
    private valueOverride_: (value: any) => any;

    constructor(match: string);
    constructor(match: RegExp);
    constructor(match: (tag: string) => boolean);
    constructor(match: any) {

        this.plugin_ = emptyPlugin();
        this.plugin_.overrideObservable = (observable, subscriber) => this.observableOverride_ ?
            this.observableOverride_(observable) :
            observable;
        this.plugin_.overrides = (observable, subscriber) => tagged(observable, this.match_);
        this.plugin_.overrideValue = (observable, subscriber, value) => this.valueOverride_ ?
            this.valueOverride_(value) :
            value;
        this.attach(match);
    }

    attach(match: string): void;
    attach(match: RegExp): void;
    attach(match: (tag: string) => boolean): void;
    attach(match: any): void {

        this.match_ = match;
        attach(this.plugin_);
    }

    detach(): void {

        detach(this.plugin_);
        this.match_ = null;
    }

    overrideObservable(override: (observable: Observable<any>) => Observable<any>): void {

        this.observableOverride_ = override;
    }

    overrideValue(override: (value: any) => any): void {

        this.valueOverride_ = override;
    }
}
