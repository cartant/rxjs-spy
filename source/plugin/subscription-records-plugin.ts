/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-debugger*/

import { Observable, Subscription } from "rxjs";
import { Spy } from "../spy-interface";
import { getSubscriptionRecord, SubscriptionRecord } from "../subscription-record";
import { BasePlugin } from "./plugin";

export class SubscriptionRecordsPlugin extends BasePlugin {

    private subscriptionRecords_: Map<Observable<any>, SubscriptionRecord> = new Map<Observable<any>, SubscriptionRecord>();

    constructor({ spy }: { spy: Spy }) { super("subscriptionRecords"); }

    beforeSubscribe(subscription: Subscription): void {

        const { subscriptionRecords_ } = this;
        const subscriptionRecord = getSubscriptionRecord(subscription);
        subscriptionRecords_.set(subscriptionRecord.observable, subscriptionRecord);
    }

    getSubscription(observable: Observable<any>): Subscription {

        const { subscriptionRecords_ } = this;
        const subscriptionRecord = subscriptionRecords_.get(observable)!;
        return subscriptionRecord ? subscriptionRecord.subscription : undefined!;
    }

    getSubscriptionRecord(observable: Observable<any>): SubscriptionRecord {

        const { subscriptionRecords_ } = this;
        return subscriptionRecords_.get(observable)!;
    }
}
