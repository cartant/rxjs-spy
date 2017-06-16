/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";
import { Subscriber } from "rxjs/Subscriber";
import { defaultLogger, Logger, PartialLogger, toLogger } from "../logger";
import { matches, MatchFunction, read } from "../operator/tag";
import { BasePlugin } from "./plugin";

export class LogPlugin extends BasePlugin {

    private logger_: Logger;
    private match_: any;

    constructor(observable: Observable<any>, partialLogger?: PartialLogger);
    constructor(match: string, partialLogger?: PartialLogger);
    constructor(match: RegExp, partialLogger?: PartialLogger);
    constructor(match: MatchFunction, partialLogger?: PartialLogger);
    constructor(match: any, partialLogger: PartialLogger = defaultLogger) {

        super();

        this.logger_ = toLogger(partialLogger);
        this.match_ = match;
    }

    beforeComplete(observable: Observable<any>, subscriber: Subscriber<any>): void {

        this.log_(observable, subscriber, "complete");
    }

    beforeError(observable: Observable<any>, subscriber: Subscriber<any>, error: any): void {

        this.log_(observable, subscriber, "error", [error]);
    }

    beforeNext(observable: Observable<any>, subscriber: Subscriber<any>, value: any): void {

        this.log_(observable, subscriber, "next", [value]);
    }

    beforeSubscribe(observable: Observable<any>, subscriber: Subscriber<any>): void {

        this.log_(observable, subscriber, "subscribe");
    }

    beforeUnsubscribe(observable: Observable<any>, subscriber: Subscriber<any>): void {

        this.log_(observable, subscriber, "unsubscribe");
    }

    private log_(
        observable: Observable<any>,
        subscriber: Subscriber<any>,
        type: string,
        params: any[] = []
    ): void {

        const { logger_, match_ } = this;

        if (matches(observable, match_)) {
            const tag = read(observable);
            const method = (type === "error") ? "error" : "log";
            logger_[method].apply(logger_, [`${type}: ${tag}`].concat(params));
        }
    }
}
