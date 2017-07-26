/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-debugger*/

import { Observable } from "rxjs/Observable";
import { Subscriber } from "rxjs/Subscriber";
import { Match, matches } from "../match";
import { BasePlugin, Notification, SubscriptionRef } from "./plugin";
import { ObservableSnapshot, SnapshotPlugin } from "./snapshot-plugin";

export class DebugPlugin extends BasePlugin {

    private notifications_: Notification[];
    private matcher_: (observable: Observable<any>, notification: Notification) => boolean;
    private snapshotPlugin_: SnapshotPlugin | null;

    constructor(match: Match, notifications: Notification[], snapshotPlugin: SnapshotPlugin | null) {

        super();

        this.notifications_ = notifications;
        this.matcher_ = (observable: Observable<any>, notification: Notification) => matches(observable, match) && (this.notifications_.indexOf(notification) !== -1);
        this.snapshotPlugin_ = snapshotPlugin;
    }

    beforeComplete(ref: SubscriptionRef): void {

        const { matcher_ } = this;
        const { observable } = ref;

        if (matcher_(observable, "complete")) {
            const snapshot = this.getSnapshot_(ref);
            debugger;
        }
    }

    beforeError(ref: SubscriptionRef, error: any): void {

        const { matcher_ } = this;
        const { observable } = ref;

        if (matcher_(observable, "error")) {
            const snapshot = this.getSnapshot_(ref);
            debugger;
        }
    }

    beforeNext(ref: SubscriptionRef, value: any): void {

        const { matcher_ } = this;
        const { observable } = ref;

        if (matcher_(observable, "next")) {
            const snapshot = this.getSnapshot_(ref);
            debugger;
        }
    }

    beforeSubscribe(ref: SubscriptionRef): void {

        const { matcher_ } = this;
        const { observable } = ref;

        if (matcher_(observable, "subscribe")) {
            const snapshot = this.getSnapshot_(ref);
            debugger;
        }
    }

    beforeUnsubscribe(ref: SubscriptionRef): void {

        const { matcher_ } = this;
        const { observable } = ref;

        if (matcher_(observable, "unsubscribe")) {
            const snapshot = this.getSnapshot_(ref);
            debugger;
        }
    }

    private getSnapshot_(ref: SubscriptionRef): ObservableSnapshot | null {

        const { snapshotPlugin_ } = this;

        if (!snapshotPlugin_) {
            return null;
        }
        return snapshotPlugin_.snapshotObservable(ref);
    }
}
