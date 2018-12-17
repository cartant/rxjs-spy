/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-debugger*/

import { Observable, Subscriber } from "rxjs";
import { Match, matches, toString as matchToString } from "../match";
import { BasePlugin, Notification } from "./plugin";
import { SubscriptionRef } from "../subscription-ref";

export class DebugPlugin extends BasePlugin {

    private notifications_: Notification[];
    private matcher_: (ref: SubscriptionRef, notification: Notification) => boolean;

    constructor(match: Match, notifications: Notification[]) {

        super(`debug(${matchToString(match)})`);

        this.notifications_ = notifications;
        this.matcher_ = (ref: SubscriptionRef, notification: Notification) => matches(ref, match) && (this.notifications_.indexOf(notification) !== -1);
    }

    beforeComplete(ref: SubscriptionRef): void {

        const { matcher_ } = this;

        if (matcher_(ref, "complete")) {
            debugger;
        }
    }

    beforeError(ref: SubscriptionRef, error: any): void {

        const { matcher_ } = this;

        if (matcher_(ref, "error")) {
            debugger;
        }
    }

    beforeNext(ref: SubscriptionRef, value: any): void {

        const { matcher_ } = this;

        if (matcher_(ref, "next")) {
            debugger;
        }
    }

    beforeSubscribe(ref: SubscriptionRef): void {

        const { matcher_ } = this;

        if (matcher_(ref, "subscribe")) {
            debugger;
        }
    }

    beforeUnsubscribe(ref: SubscriptionRef): void {

        const { matcher_ } = this;

        if (matcher_(ref, "unsubscribe")) {
            debugger;
        }
    }
}
