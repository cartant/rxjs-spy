/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-debugger*/

import { Observable } from "rxjs/Observable";
import { Subscriber } from "rxjs/Subscriber";
import { Match, matches, toString as matchToString } from "../match";
import { BasePlugin, Notification, SubscriberRef, SubscriptionRef } from "./plugin";

export class DebugPlugin extends BasePlugin {

    private notifications_: Notification[];
    private matcher_: (observable: Observable<any>, notification: Notification) => boolean;

    constructor(match: Match, notifications: Notification[]) {

        super(`debug(${matchToString(match)})`);

        this.notifications_ = notifications;
        this.matcher_ = (observable: Observable<any>, notification: Notification) => matches(observable, match) && (this.notifications_.indexOf(notification) !== -1);
    }

    beforeComplete(ref: SubscriptionRef): void {

        const { matcher_ } = this;
        const { observable } = ref;

        if (matcher_(observable, "complete")) {
            debugger;
        }
    }

    beforeError(ref: SubscriptionRef, error: any): void {

        const { matcher_ } = this;
        const { observable } = ref;

        if (matcher_(observable, "error")) {
            debugger;
        }
    }

    beforeNext(ref: SubscriptionRef, value: any): void {

        const { matcher_ } = this;
        const { observable } = ref;

        if (matcher_(observable, "next")) {
            debugger;
        }
    }

    beforeSubscribe(ref: SubscriberRef): void {

        const { matcher_ } = this;
        const { observable } = ref;

        if (matcher_(observable, "subscribe")) {
            debugger;
        }
    }

    beforeUnsubscribe(ref: SubscriptionRef): void {

        const { matcher_ } = this;
        const { observable } = ref;

        if (matcher_(observable, "unsubscribe")) {
            debugger;
        }
    }
}
