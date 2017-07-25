/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";
import { Subscriber } from "rxjs/Subscriber";
import { defaultLogger, Logger, PartialLogger, toLogger } from "../logger";
import { Match, matches, read, toString as matchToString } from "../match";
import { BasePlugin, Notification } from "./plugin";
import { SnapshotPlugin } from "./snapshot-plugin";

export class LogPlugin extends BasePlugin {

    private logger_: Logger;
    private match_: Match;
    private snapshotPlugin_: SnapshotPlugin | null;

    constructor(match: Match, partialLogger: PartialLogger = defaultLogger, snapshotPlugin: SnapshotPlugin | null) {

        super();

        this.logger_ = toLogger(partialLogger);
        this.match_ = match;
        this.snapshotPlugin_ = snapshotPlugin;
    }

    beforeComplete(observable: Observable<any>, subscriber: Subscriber<any>): void {

        this.log_(observable, subscriber, "complete");
    }

    beforeError(observable: Observable<any>, subscriber: Subscriber<any>, error: any): void {

        this.log_(observable, subscriber, "error", error);
    }

    beforeNext(observable: Observable<any>, subscriber: Subscriber<any>, value: any): void {

        this.log_(observable, subscriber, "next", value);
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
        notification: Notification,
        param: any = null
    ): void {

        const { logger_, match_, snapshotPlugin_ } = this;

        if (matches(observable, match_)) {
            const tag = read(observable);
            switch (notification) {
            case "error":
                logger_.groupCollapsed(`${param.toString()}; tag = ${tag}; notification = ${notification}`);
                logger_.error("Error =", param);
                break;
            case "next":
                logger_.groupCollapsed(`${param.toString()}; tag = ${tag}; notification = ${notification}`);
                logger_.log("Value =", param);
                break;
            default:
                logger_.groupCollapsed(`Tag = ${tag}; notification = ${notification}`);
                break;
            }
            logger_.log("Matching", matchToString(match_));
            if (snapshotPlugin_) {
                const snapshot = snapshotPlugin_.peekAtSubscriber(observable, subscriber);
                if (snapshot) {
                    logger_.log(`${snapshot.explicit ? "Ex" : "Im"}plicit subscribe =`, snapshot.stackTrace);
                }
            }
            logger_.groupCollapsed("Raw observable");
            logger_.log(observable);
            logger_.groupEnd();
            logger_.groupEnd();
        }
    }
}
