/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Subscription } from "rxjs";
import { Auditor } from "../auditor";
import { identify } from "../identify";
import { Logger, PartialLogger, toLogger } from "../logger";
import { Match, matches, read, toString as matchToString } from "../match";
import { Spy } from "../spy-interface";
import { getSubscriptionRef, SubscriptionRef } from "../subscription-ref";
import { BasePlugin, Notification } from "./plugin";

const defaultMatch = /.+/;

export class LogPlugin extends BasePlugin {

    private auditor_: Auditor;
    private logger_: Logger;
    private notificationMatch_: Match;
    private observableMatch_: Match;

    constructor({
        logger,
        notificationMatch,
        observableMatch,
        spy
    }: {
        logger?: PartialLogger,
        notificationMatch?: Match,
        observableMatch?: Match,
        spy: Spy
    }) {

        super(`log(${matchToString(observableMatch || defaultMatch)})`);

        this.auditor_ = spy.auditor;
        this.logger_ = logger ? toLogger(logger) : spy.logger;
        this.notificationMatch_ = notificationMatch || defaultMatch;
        this.observableMatch_ = observableMatch || defaultMatch;
    }

    beforeComplete(subscription: Subscription): void {
        const subscriptionRef = getSubscriptionRef(subscription);
        this.log_(subscriptionRef, "complete");
    }

    beforeError(subscription: Subscription, error: any): void {
        const subscriptionRef = getSubscriptionRef(subscription);
        this.log_(subscriptionRef, "error", error);
    }

    beforeNext(subscription: Subscription, value: any): void {
        const subscriptionRef = getSubscriptionRef(subscription);
        this.log_(subscriptionRef, "next", value);
    }

    beforeSubscribe(subscription: Subscription): void {
        const subscriptionRef = getSubscriptionRef(subscription);
        this.log_(subscriptionRef, "subscribe");
    }

    beforeUnsubscribe(subscription: Subscription): void {
        const subscriptionRef = getSubscriptionRef(subscription);
        this.log_(subscriptionRef, "unsubscribe");
    }

    private log_(
        subscriptionRef: SubscriptionRef,
        notification: Notification,
        param?: any
    ): void {

        const { auditor_, notificationMatch_, observableMatch_ } = this;

        if (matches(subscriptionRef, observableMatch_) && matches(subscriptionRef, notificationMatch_, notification)) {

            auditor_.audit(this, ignored => {

                const { logger_ } = this;
                const { observable } = subscriptionRef;
                const id = identify(observable);
                const tag = read(observable);

                let identifier = tag ? `Tag = ${tag}` : `ID = ${id}`;
                if ((typeof observableMatch_ === "number") || (typeof observableMatch_ === "string")) {
                    if (observableMatch_.toString() !== tag) {
                        identifier = `ID = ${id}`;
                    }
                }

                const matching = (typeof observableMatch_ === "object") ? `; matching ${matchToString(observableMatch_)}` : "";
                const audit  = (ignored === 0) ? "" : `; ignored ${ignored}`;
                const description = `${identifier}; notification = ${notification}${matching}${audit}`;

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
