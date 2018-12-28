/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-debugger*/

import { Observable, Subscription } from "rxjs";
import { Spy } from "../spy-interface";
import { getSubscriptionLabel, SubscriptionLabel } from "../subscription-label";
import { BasePlugin } from "./plugin";

export class SubscriptionLabelsPlugin extends BasePlugin {

    private subscriptionLabels_: Map<Observable<any>, SubscriptionLabel> = new Map<Observable<any>, SubscriptionLabel>();

    constructor({ spy }: { spy: Spy }) { super("subscriptionLabels"); }

    beforeSubscribe(subscription: Subscription): void {

        const { subscriptionLabels_ } = this;
        const subscriptionLabel = getSubscriptionLabel(subscription);
        subscriptionLabels_.set(subscriptionLabel.observable, subscriptionLabel);
    }

    getSubscription(observable: Observable<any>): Subscription {

        const { subscriptionLabels_ } = this;
        const subscriptionLabel = subscriptionLabels_.get(observable)!;
        return subscriptionLabel ? subscriptionLabel.subscription : undefined!;
    }

    getSubscriptionLabel(observable: Observable<any>): SubscriptionLabel {

        const { subscriptionLabels_ } = this;
        return subscriptionLabels_.get(observable)!;
    }
}
