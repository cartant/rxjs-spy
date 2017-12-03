/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";
import { Subscriber } from "rxjs/Subscriber";
import { getGraphRef } from "./graph-plugin";
import { defaultLogger, Logger, PartialLogger, toLogger } from "../logger";
import { Match, matches, read, toString as matchToString } from "../match";
import { BasePlugin, Notification } from "./plugin";
import { getSnapshotRef } from "./snapshot-plugin";
import { getStackTrace, getStackTraceRef } from "./stack-trace-plugin";
import { SubscriberRef, SubscriptionRef } from "../subscription-ref";
import { inferType } from "../util";

export class LogPlugin extends BasePlugin {

    private logger_: Logger;
    private match_: Match;
    private verbose_ = false;

    constructor(match: Match, partialLogger: PartialLogger = defaultLogger) {

        super(`log(${matchToString(match)})`);

        this.logger_ = toLogger(partialLogger);
        this.match_ = match;
    }

    beforeComplete(ref: SubscriptionRef): void {

        this.log_(ref, "complete");
    }

    beforeError(ref: SubscriptionRef, error: any): void {

        this.log_(ref, "error", error);
    }

    beforeNext(ref: SubscriptionRef, value: any): void {

        this.log_(ref, "next", value);
    }

    beforeSubscribe(ref: SubscriberRef): void {

        this.log_(ref, "subscribe");
    }

    beforeUnsubscribe(ref: SubscriptionRef): void {

        this.log_(ref, "unsubscribe");
    }

    private log_(
        ref: SubscriberRef,
        notification: Notification,
        param?: any
    ): void {

        const { logger_, match_, verbose_ } = this;
        const { observable, subscriber } = ref;

        if (matches(ref, match_)) {

            const tag = read(observable);
            const type = inferType(observable);
            const matching = (typeof match_ === "string") ? "" : `; matching ${matchToString(match_)}`;
            const description = tag ?
                `Tag = ${tag}; notification = ${notification}${matching}` :
                `Type = ${type}; notification = ${notification}${matching}`;

            if (verbose_) {

                switch (notification) {
                case "error":
                    logger_.group(description);
                    logger_.error("Error =", param);
                    break;
                case "next":
                    logger_.group(description);
                    logger_.log("Value =", param);
                    break;
                default:
                    logger_.groupCollapsed(description);
                    break;
                }

                const graphRef = getGraphRef(ref);
                const snapshotRef = getSnapshotRef(ref);
                const stackTraceRef = getStackTraceRef(ref);

                if ((graphRef && stackTraceRef) || snapshotRef) {
                    logger_.groupCollapsed("Subscriber");
                    if (snapshotRef) {
                        const { values, valuesFlushed } = snapshotRef;
                        logger_.log("Value count =", values.length + valuesFlushed);
                        if (values.length > 0) {
                            logger_.log("Last value =", values[values.length - 1].value);
                        }
                    }
                    if (graphRef && stackTraceRef) {
                        logger_.groupCollapsed("Subscription");
                        const { rootSink } = graphRef;
                        logger_.log("Root subscribe", rootSink ? getStackTrace(rootSink) : getStackTrace(ref));
                        logger_.groupEnd();
                    }
                    logger_.groupEnd();
                }

                logger_.groupEnd();

            } else {

                switch (notification) {
                case "error":
                    logger_.error(`${description}; error =`, param);
                    break;
                case "next":
                    logger_.log(`${description}; value =`, param);
                    break;
                default:
                    logger_.log(description);
                    break;
                }
            }
        }
    }
}
