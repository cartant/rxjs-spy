/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Subscription } from "rxjs";
import { Snapshot, SnapshotPlugin, SubscriptionSnapshot } from "./plugin/snapshot-plugin";
import { Spy } from "./spy-interface";

export interface Swept {
    flatSubscriptions: SubscriptionSnapshot[];
    flatUnsubscriptions: SubscriptionSnapshot[];
    subscriptions: SubscriptionSnapshot[];
    unsubscriptions: SubscriptionSnapshot[];
}

interface SweptRecord {
    snapshotRecords: SweptSnapshotRecord[];
}

interface SweptSnapshotRecord {
    rootSubscriptions: Map<Subscription, SweptSubscriptionRecord>;
    snapshot: Snapshot;
}

interface SweptSubscriptionRecord {
    flats: Map<Subscription, SubscriptionSnapshot>;
    subscriptionSnapshot: SubscriptionSnapshot;
}

type FoundPlugins = {
    snapshotPlugin: SnapshotPlugin | undefined;
};

export class Sweeper {

    private foundPlugins_: FoundPlugins | undefined;
    private sweptRecords_: Map<string, SweptRecord>;
    private spy_: Spy;

    constructor(spy: Spy) {

        this.sweptRecords_ = new Map<string, SweptRecord>();
        this.spy_ = spy;
    }

    sweep(id: string): Swept | undefined {

        const { snapshotPlugin } = this.findPlugins_();
        if (!snapshotPlugin) {
            return undefined;
        }

        const { sweptRecords_ } = this;
        let sweeperRecord = sweptRecords_.get(id);
        const snapshotRecord = this.record_(snapshotPlugin.snapshotAll());

        if (sweeperRecord) {
            sweeperRecord.snapshotRecords.push(snapshotRecord);
        } else {
            sweeperRecord = {
                snapshotRecords: [snapshotRecord]
            };
            sweptRecords_.set(id, sweeperRecord);
        }
        if (sweeperRecord.snapshotRecords.length > 2) {
            sweeperRecord.snapshotRecords.shift();
        }
        if (sweeperRecord.snapshotRecords.length < 2) {
            return undefined;
        }

        const [previous, current] = sweeperRecord.snapshotRecords;
        return this.compare_(id, previous, current);
    }

    private compare_(id: string, previous: SweptSnapshotRecord, current: SweptSnapshotRecord): Swept | undefined {

        const subscriptions: SweptSubscriptionRecord[] = [];
        const unsubscriptions: SweptSubscriptionRecord[] = [];
        const flatSubscriptions: SubscriptionSnapshot[] = [];
        const flatUnsubscriptions: SubscriptionSnapshot[] = [];

        const { rootSubscriptions: previousSubscriptions } = previous;
        const { rootSubscriptions: currentSubscriptions } = current;

        previousSubscriptions.forEach((previous, key) => {

            if (!currentSubscriptions.has(key)) {
                unsubscriptions.push(previous);
            }
        });
        currentSubscriptions.forEach((current, key) => {

            const previous = previousSubscriptions.get(key);
            if (previous) {

                const { flats: previousFlats } = previous;
                const { flats: currentFlats } = current;

                previousFlats.forEach((flat, key) => {
                    if (!currentFlats.has(key)) {
                        flatUnsubscriptions.push(flat);
                    }
                });
                currentFlats.forEach((flat, key) => {
                    if (!previousFlats.has(key)) {
                        flatSubscriptions.push(flat);
                    }
                });
            } else {
                subscriptions.push(current);
            }
        });

        if (
            flatSubscriptions.length === 0 &&
            flatUnsubscriptions.length === 0 &&
            subscriptions.length === 0 &&
            unsubscriptions.length === 0
        ) {
            return undefined;
        }

        return {
            flatSubscriptions,
            flatUnsubscriptions,
            subscriptions: subscriptions.map(s => s.subscriptionSnapshot),
            unsubscriptions: unsubscriptions.map(s => s.subscriptionSnapshot)
        };
    }

    private findFlatSubscriptions_(
        snapshot: Snapshot,
        subscriptionRecord: SweptSubscriptionRecord
    ): void {

        const { flats } = subscriptionRecord;

        snapshot.subscriptions.forEach(s => {
            s.flats.forEach(f => {
                const { subscription } = f;
                if (!subscription.closed) {
                    flats.set(subscription, f);
                }
            });
        });
    }

    private findPlugins_(): FoundPlugins {

        const { foundPlugins_, spy_ } = this;
        if (foundPlugins_) {
            return foundPlugins_;
        }

        const [snapshotPlugin] = spy_.find(SnapshotPlugin);
        if (!snapshotPlugin) {
            this.spy_.logger.warnOnce("Sweeping is not enabled; add the SnapshotPlugin.");
        }

        this.foundPlugins_ = { snapshotPlugin };
        return this.foundPlugins_;
    }

    private findRootSubscriptions_(
        snapshot: Snapshot,
        rootSubscriptions: Map<Subscription, SweptSubscriptionRecord>
    ): void {

        snapshot.observables.forEach(observableSnapshot => {
            observableSnapshot.subscriptions.forEach(subscriptionSnapshot => {
                const { completeTimestamp, errorTimestamp, sink, subscription } = subscriptionSnapshot;
                if (!completeTimestamp && !errorTimestamp && !sink && !subscription.closed) {
                    const subscriptionRecord = {
                        flats: new Map<Subscription, SubscriptionSnapshot>(),
                        subscriptionSnapshot
                    };
                    this.findFlatSubscriptions_(snapshot, subscriptionRecord);
                    rootSubscriptions.set(subscription, subscriptionRecord);
                }
            });
        });
    }

    private record_(snapshot: Snapshot): SweptSnapshotRecord {

        const rootSubscriptions = new Map<Subscription, SweptSubscriptionRecord>();
        this.findRootSubscriptions_(snapshot, rootSubscriptions);

        return { rootSubscriptions, snapshot };
    }
}
