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

interface SweeperRecord {
    snapshotRecords: SnapshotRecord[];
}

interface SnapshotRecord {
    rootSubscriptions: Map<Subscription, SubscriptionRecord>;
    snapshot: Snapshot;
}

interface SubscriptionRecord {
    flats: Map<Subscription, SubscriptionSnapshot>;
    subscriptionSnapshot: SubscriptionSnapshot;
}

export class Sweeper {

    private sweeperRecords_: Map<string, SweeperRecord>;
    private snapshotPlugin_: SnapshotPlugin | undefined;
    private spy_: Spy;

    constructor(spy: Spy) {

        this.sweeperRecords_ = new Map<string, SweeperRecord>();
        this.snapshotPlugin_ = spy.find(SnapshotPlugin);
        this.spy_ = spy;
    }

    sweep(id: string): Swept | undefined {

        const { sweeperRecords_, snapshotPlugin_, spy_ } = this;

        if (!snapshotPlugin_) {
            spy_.logger.warnOnce("Snapshotting is not enabled.");
            return undefined;
        }

        let sweeperRecord = sweeperRecords_.get(id);
        const snapshotRecord = this.record_(snapshotPlugin_.snapshotAll());

        if (sweeperRecord) {
            sweeperRecord.snapshotRecords.push(snapshotRecord);
        } else {
            sweeperRecord = {
                snapshotRecords: [snapshotRecord]
            };
            sweeperRecords_.set(id, sweeperRecord);
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

    private compare_(id: string, previous: SnapshotRecord, current: SnapshotRecord): Swept | undefined {

        const subscriptions: SubscriptionRecord[] = [];
        const unsubscriptions: SubscriptionRecord[] = [];
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
        subscriptionRecord: SubscriptionRecord
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

    private findRootSubscriptions_(
        snapshot: Snapshot,
        rootSubscriptions: Map<Subscription, SubscriptionRecord>
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

    private record_(snapshot: Snapshot): SnapshotRecord {

        const rootSubscriptions = new Map<Subscription, SubscriptionRecord>();
        this.findRootSubscriptions_(snapshot, rootSubscriptions);

        return { rootSubscriptions, snapshot };
    }
}
