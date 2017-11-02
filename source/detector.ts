/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Subscription } from "rxjs/Subscription";

import {
    ObservableSnapshot,
    Snapshot,
    SnapshotPlugin,
    SubscriberSnapshot,
    SubscriptionSnapshot
} from "./plugin/snapshot-plugin";

export interface Detected {
    mergeSubscriptions: SubscriptionSnapshot[];
    mergeUnsubscriptions: SubscriptionSnapshot[];
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
    merges: Map<Subscription, SubscriptionSnapshot>;
    subscriptionSnapshot: SubscriptionSnapshot;
}

export class Detector {

    private detectorRecords_: Map<string, DetectorRecord>;
    private snapshotPlugin_: SnapshotPlugin | null;

    constructor(snapshotPlugin: SnapshotPlugin | null) {

        this.detectorRecords_ = new Map<string, DetectorRecord>();
        this.snapshotPlugin_ = snapshotPlugin;
    }

    detect(id: string): Detected | null {

        const { detectorRecords_, snapshotPlugin_ } = this;

        if (!snapshotPlugin_) {
            /*tslint:disable-next-line:no-console*/
            console.warn("Snapshotting is not enabled.");
            return null;
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
            return null;
        }

        const [previous, current] = detectorRecord.snapshotRecords;
        return this.compare_(id, previous, current);
    }

    private compare_(id: string, previous: SnapshotRecord, current: SnapshotRecord): Detected | null {

        const subscriptions: SubscriptionRecord[] = [];
        const unsubscriptions: SubscriptionRecord[] = [];
        const mergeSubscriptions: SubscriptionSnapshot[] = [];
        const mergeUnsubscriptions: SubscriptionSnapshot[] = [];

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

                const { merges: previousMerges } = previous;
                const { merges: currentMerges } = current;

                previousMerges.forEach((merge, key) => {
                    if (!currentMerges.has(key)) {
                        mergeUnsubscriptions.push(merge);
                    }
                });
                currentMerges.forEach((merge, key) => {
                    if (!previousMerges.has(key)) {
                        mergeSubscriptions.push(merge);
                    }
                });
            } else {
                subscriptions.push(current);
            }
        });

        if (
            mergeSubscriptions.length === 0 &&
            mergeUnsubscriptions.length === 0 &&
            subscriptions.length === 0 &&
            unsubscriptions.length === 0
        ) {
            return null;
        }

        return {
            mergeSubscriptions,
            mergeUnsubscriptions,
            subscriptions: subscriptions.map((s) => s.subscriptionSnapshot),
            unsubscriptions: unsubscriptions.map((s) => s.subscriptionSnapshot)
        };
    }

    private findMergedSubscriptions_(
        snapshot: Snapshot,
        subscriptionRecord: SubscriptionRecord
    ): void {

        const { merges, subscriptionSnapshot } = subscriptionRecord;

        snapshot.subscriptions.forEach((s) => {
            if (s.rootSink === subscriptionSnapshot) {
                s.merges.forEach((m) => {
                    const { subscription } = m;
                    if (!subscription.closed) {
                        merges.set(subscription, m);
                    }
                });
            }
        });
    }

    private findRootSubscriptions_(
        snapshot: Snapshot,
        rootSubscriptions: Map<Subscription, SubscriptionRecord>
    ): void {

        snapshot.observables.forEach((observableSnapshot) => {
            observableSnapshot.subscribers.forEach((subscriberSnapshot) => {
                subscriberSnapshot.subscriptions.forEach((subscriptionSnapshot) => {
                    const { complete, error, sink, subscription } = subscriptionSnapshot;
                    if (!complete && !error && !sink && !subscription.closed) {
                        const subscriptionRecord = {
                            merges: new Map<Subscription, SubscriptionSnapshot>(),
                            subscriptionSnapshot
                        };
                        this.findMergedSubscriptions_(snapshot, subscriptionRecord);
                        rootSubscriptions.set(subscription, subscriptionRecord);
                    }
                });
            });
        });
    }

    private record_(snapshot: Snapshot): SnapshotRecord {

        const rootSubscriptions = new Map<Subscription, SubscriptionRecord>();
        this.findRootSubscriptions_(snapshot, rootSubscriptions);

        return { rootSubscriptions, snapshot };
    }
}
