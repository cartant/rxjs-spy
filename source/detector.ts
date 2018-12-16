/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Subscription } from "rxjs";

import {
    ObservableSnapshot,
    Snapshot,
    SnapshotPlugin,
    SubscriberSnapshot,
    SubscriptionSnapshot
} from "./plugin/snapshot-plugin";

import { Spy } from "./spy-interface";

export interface Detected {
    flatteningSubscriptions: SubscriptionSnapshot[];
    flatteningUnsubscriptions: SubscriptionSnapshot[];
    subscriptions: SubscriptionSnapshot[];
    unsubscriptions: SubscriptionSnapshot[];
}

interface DetectorRecord {
    snapshotRecords: SnapshotRecord[];
}

interface SnapshotRecord {
    rootSubscriptions: Map<Subscription, SubscriptionRecord>;
    snapshot: Snapshot;
}

interface SubscriptionRecord {
    flattenings: Map<Subscription, SubscriptionSnapshot>;
    subscriptionSnapshot: SubscriptionSnapshot;
}

export class Detector {

    private detectorRecords_: Map<string, DetectorRecord>;
    private snapshotPlugin_: SnapshotPlugin | undefined;
    private spy_: Spy;

    constructor(spy: Spy) {

        this.detectorRecords_ = new Map<string, DetectorRecord>();
        this.snapshotPlugin_ = spy.find(SnapshotPlugin);
        this.spy_ = spy;
    }

    detect(id: string): Detected | undefined {

        const { detectorRecords_, snapshotPlugin_, spy_ } = this;

        if (!snapshotPlugin_) {
            spy_.warnOnce(console, "Snapshotting is not enabled.");
            return undefined;
        }

        let detectorRecord = detectorRecords_.get(id);
        const snapshotRecord = this.record_(snapshotPlugin_.snapshotAll());

        if (detectorRecord) {
            detectorRecord.snapshotRecords.push(snapshotRecord);
        } else {
            detectorRecord = {
                snapshotRecords: [snapshotRecord]
            };
            detectorRecords_.set(id, detectorRecord);
        }
        if (detectorRecord.snapshotRecords.length > 2) {
            detectorRecord.snapshotRecords.shift();
        }
        if (detectorRecord.snapshotRecords.length < 2) {
            return undefined;
        }

        const [previous, current] = detectorRecord.snapshotRecords;
        return this.compare_(id, previous, current);
    }

    private compare_(id: string, previous: SnapshotRecord, current: SnapshotRecord): Detected | undefined {

        const subscriptions: SubscriptionRecord[] = [];
        const unsubscriptions: SubscriptionRecord[] = [];
        const flatteningSubscriptions: SubscriptionSnapshot[] = [];
        const flatteningUnsubscriptions: SubscriptionSnapshot[] = [];

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

                const { flattenings: previousFlattenings } = previous;
                const { flattenings: currentFlattenings } = current;

                previousFlattenings.forEach((flattening, key) => {
                    if (!currentFlattenings.has(key)) {
                        flatteningUnsubscriptions.push(flattening);
                    }
                });
                currentFlattenings.forEach((flattening, key) => {
                    if (!previousFlattenings.has(key)) {
                        flatteningSubscriptions.push(flattening);
                    }
                });
            } else {
                subscriptions.push(current);
            }
        });

        if (
            flatteningSubscriptions.length === 0 &&
            flatteningUnsubscriptions.length === 0 &&
            subscriptions.length === 0 &&
            unsubscriptions.length === 0
        ) {
            return undefined;
        }

        return {
            flatteningSubscriptions,
            flatteningUnsubscriptions,
            subscriptions: subscriptions.map((s) => s.subscriptionSnapshot),
            unsubscriptions: unsubscriptions.map((s) => s.subscriptionSnapshot)
        };
    }

    private findFlatteningSubscriptions_(
        snapshot: Snapshot,
        subscriptionRecord: SubscriptionRecord
    ): void {

        const { flattenings, subscriptionSnapshot } = subscriptionRecord;

        snapshot.subscriptions.forEach((s) => {
            s.flattenings.forEach((f) => {
                const { subscription } = f;
                if (!subscription.closed) {
                    flattenings.set(subscription, f);
                }
            });
        });
    }

    private findRootSubscriptions_(
        snapshot: Snapshot,
        rootSubscriptions: Map<Subscription, SubscriptionRecord>
    ): void {

        snapshot.observables.forEach((observableSnapshot) => {
            observableSnapshot.subscriptions.forEach((subscriptionSnapshot) => {
                const { complete, error, sink, subscription } = subscriptionSnapshot;
                if (!complete && !error && !sink && !subscription.closed) {
                    const subscriptionRecord = {
                        flattenings: new Map<Subscription, SubscriptionSnapshot>(),
                        subscriptionSnapshot
                    };
                    this.findFlatteningSubscriptions_(snapshot, subscriptionRecord);
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
