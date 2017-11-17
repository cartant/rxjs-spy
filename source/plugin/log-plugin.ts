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
import { BasePlugin, Notification, SubscriberRef, SubscriptionRef } from "./plugin";
import { getSnapshotRef } from "./snapshot-plugin";
import { getStackTrace, getType } from "./stack-trace-plugin";

export class LogPlugin extends BasePlugin {

    private logger_: Logger;
    private match_: Match;

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

        const { logger_, match_ } = this;
        const { observable, subscriber } = ref;

        if (matches(observable, match_)) {

            const tag = read(observable);
            const type = getType(ref);
            const matching = (typeof match_ === "string") ? "" : `; matching ${matchToString(match_)}`;
            const group = tag ?
                `Tag = ${tag}; notification = ${notification}${matching}` :
                `Type = ${type}; notification = ${notification}${matching}`;

            switch (notification) {
            case "error":
                logger_.group(group);
                logger_.error("Error =", param);
                break;
            case "next":
                logger_.group(group);
                logger_.log("Value =", param);
                break;
            default:
                logger_.groupCollapsed(group);
                break;
            }

            const graphRef = getGraphRef(ref);
            const snapshotRef = getSnapshotRef(ref);

            if (graphRef || snapshotRef) {
                const { values, valuesFlushed } = snapshotRef;
                logger_.groupCollapsed("Subscriber");
                if (snapshotRef) {
                    logger_.log("Value count =", values.length + valuesFlushed);
                    if (values.length > 0) {
                        logger_.log("Last value =", values[values.length - 1].value);
                    }
                }
                if (graphRef) {
                    logger_.groupCollapsed("Subscription");
                    const { rootSink } = graphRef;
                    logger_.log("Root subscribe", rootSink ? getStackTrace(rootSink) : getStackTrace(ref));
                    logger_.groupEnd();
                }
                logger_.groupEnd();
            }

            logger_.groupCollapsed("Raw observable");
            logger_.log(observable);
            logger_.groupEnd();
            logger_.groupEnd();
        }
    }
}
