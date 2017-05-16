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

    private observableOverrides_: {
        match: any;
        override: (observable: Observable<any>) => Observable<any>;
    }[] = [];
    private plugin_: Plugin;
    private valueOverrides_: {
        match: any;
        override: (value: any) => any;
    }[] = [];

    constructor() {

        this.plugin_ = emptyPlugin();
        this.plugin_.overrideObservable = (observable: Observable<any>, subscriber: Subscriber<any>) => {

            const found = this.observableOverrides_.find((o) => tagged(observable, o.match));
            return found ? found.override(observable) : observable;
        };
        this.plugin_.overrideValue = (observable: Observable<any>, subscriber: Subscriber<any>, value: any) => {

            const found = this.valueOverrides_.find((o) => tagged(observable, o.match));
            return found ? found.override(value) : value;
        };
        this.attach();
    }

    attach(): void {

        attach(this.plugin_);
    }

    detach(): void {

        detach(this.plugin_);
    }

    overrideObservable(match: string, override: (observable: Observable<any>) => Observable<any>): void;
    overrideObservable(match: RegExp, override: (observable: Observable<any>) => Observable<any>): void;
    overrideObservable(match: (tag: string) => boolean, override: (observable: Observable<any>) => Observable<any>): void;
    overrideObservable(match: any, override: (observable: Observable<any>) => Observable<any>): void {

        this.observableOverrides_.push({ match, override });
    }

    overrideValue(match: string, override: (value: any) => any): void;
    overrideValue(match: RegExp, override: (value: any) => any): void;
    overrideValue(match: (tag: string) => boolean, override: (value: any) => any): void;
    overrideValue(match: any, override: (value: any) => any): void {

        this.valueOverrides_.push({ match, override });
    }
}
