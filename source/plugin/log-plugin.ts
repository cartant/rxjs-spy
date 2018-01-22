/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";
import { Subscriber } from "rxjs/Subscriber";
import { Auditor } from "../auditor";
import { defaultLogger, Logger, PartialLogger, toLogger } from "../logger";
import { Match, matches, read, toString as matchToString } from "../match";
import { BasePlugin, Notification } from "./plugin";
import { Spy } from "../spy-interface";
import { SubscriberRef, SubscriptionRef } from "../subscription-ref";
import { inferType } from "../util";

export class LogPlugin extends BasePlugin {

    private auditor_: Auditor;
    private logger_: Logger;
    private match_: Match;

    constructor(spy: Spy, match: Match, partialLogger: PartialLogger = defaultLogger) {

        super(`log(${matchToString(match)})`);

        this.auditor_ = spy.auditor;
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

        const { auditor_, match_ } = this;

        if (matches(ref, match_)) {

            auditor_.audit(this, (ignored) => {

                const { logger_ } = this;
                const { observable, subscriber } = ref;
                const tag = read(observable);
                const type = inferType(observable);

                const matching = (typeof match_ === "string") ? "" : `; matching ${matchToString(match_)}`;
                const audit  = (ignored === 0) ? "" : `; ignored ${ignored}`;
                const description = tag ?
                    `Tag = ${tag}; notification = ${notification}${matching}${audit}` :
                    `Type = ${type}; notification = ${notification}${matching}${audit}`;

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
            });
        }
    }
}
