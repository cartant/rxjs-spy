/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";
import { Subscriber } from "rxjs/Subscriber";
import { read, tagged } from "./operator/tag";
import { emptyPlugin, Plugin } from "./plugin";
import { attach, detach } from "./spy";

export class Logger {

    private logger_: any = console;
    private match_: any;
    private plugin_: Plugin;

    constructor(match: string);
    constructor(match: RegExp);
    constructor(match: (tag: string) => boolean);
    constructor(match: any) {

        this.plugin_ = emptyPlugin();
        this.plugin_.beforeComplete = (observable, subscriber) => this.log_(observable, subscriber, "complete");
        this.plugin_.beforeError = (observable, subscriber, error) => this.log_(observable, subscriber, "error", [error]);
        this.plugin_.beforeNext = (observable, subscriber, value) => this.log_(observable, subscriber, "next", [value]);
        this.plugin_.beforeSubscribe = (observable, subscriber) => this.log_(observable, subscriber, "subscribe");
        this.plugin_.beforeUnsubscribe = (observable, subscriber) => this.log_(observable, subscriber, "unsubscribe");
        this.attach(match);
    }

    set logger(value: any) {

        this.logger_ = value;
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

    private log_(
        observable: Observable<any>,
        subscriber: Subscriber<any>,
        type: string,
        params: any[] = []
    ): void {

        if (tagged(observable, this.match_)) {
            const { logger_ } = this;
            const tag = read(observable);
            logger_.log.apply(logger_, [`${type}: ${tag}`].concat(params));
        }
    }
}
