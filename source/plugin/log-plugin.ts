/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

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
    private notificationMatch_: Match;
    private tagMatch_: Match;

    constructor(
        spy: Spy,
        tagMatch: Match,
        partialLogger?: PartialLogger
    );
    constructor(
        spy: Spy,
        tagMatch: Match,
        notifcationMatch: Match,
        partialLogger?: PartialLogger
    );
    constructor(
        spy: Spy,
        tagMatch: Match,
        ...args: any[]
    ) {

        super(`log(${matchToString(tagMatch)})`);

        this.auditor_ = spy.auditor;
        this.tagMatch_ = tagMatch;

        const defaultMatch = /.+/;
        switch (args.length) {
        case 0:
            this.notificationMatch_ = defaultMatch;
            this.logger_ = toLogger(defaultLogger);
            break;
        case 1:
            if (typeof args[0] === "function") {
                this.notificationMatch_ = args[0];
                this.logger_ = toLogger(defaultLogger);
            } else {
                this.notificationMatch_ = defaultMatch;
                this.logger_ = toLogger(args[0]);
            }
            break;
        default:
            this.notificationMatch_ = args[0];
            this.logger_ = toLogger(args[1]);
            break;
        }
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

        const { auditor_, notificationMatch_, tagMatch_ } = this;

        if (matches(ref, tagMatch_) && matches(ref, notificationMatch_, notification)) {

            auditor_.audit(this, (ignored) => {

                const { logger_ } = this;
                const { observable, subscriber } = ref;
                const tag = read(observable);
                const type = inferType(observable);

                const matching = (typeof tagMatch_ === "string") ? "" : `; matching ${matchToString(tagMatch_)}`;
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
