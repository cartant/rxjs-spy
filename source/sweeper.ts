/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Subscription } from "rxjs";
import { Snapshot, SnapshotPlugin, SubscriptionSnapshot } from "./plugin/snapshot-plugin";
import { Spy } from "./spy-interface";

export interface Swept {
    innerSubscriptions: SubscriptionSnapshot[];
    innerUnsubscriptions: SubscriptionSnapshot[];
    rootSubscriptions: SubscriptionSnapshot[];
    rootUnsubscriptions: SubscriptionSnapshot[];
}

interface SweptRecord {
    snapshotRecords: SweptSnapshotRecord[];
}

interface SweptSnapshotRecord {
    roots: Map<Subscription, SweptSubscriptionRecord>;
    snapshot: Snapshot;
}

interface SweptSubscriptionRecord {
    inners: Map<Subscription, SubscriptionSnapshot>;
    outer: SubscriptionSnapshot;
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

        const rootSubscriptions: SweptSubscriptionRecord[] = [];
        const rootUnsubscriptions: SweptSubscriptionRecord[] = [];
        const innerSubscriptions: SubscriptionSnapshot[] = [];
        const innerUnsubscriptions: SubscriptionSnapshot[] = [];

        const { roots: previousRoots } = previous;
        const { roots: currentRoots } = current;

        previousRoots.forEach((previous, key) => {

            if (!currentRoots.has(key)) {
                rootUnsubscriptions.push(previous);
            }
        });
        currentRoots.forEach((current, key) => {

            const previous = previousRoots.get(key);
            if (previous) {

                const { inners: previousInners } = previous;
                const { inners: currentInners } = current;

                previousInners.forEach((inner, key) => {
                    if (!currentInners.has(key)) {
                        innerUnsubscriptions.push(inner);
                    }
                });
                currentInners.forEach((inner, key) => {
                    if (!previousInners.has(key)) {
                        innerSubscriptions.push(inner);
                    }
                });
            } else {
                rootSubscriptions.push(current);
            }
        });

        if (
            innerSubscriptions.length === 0 &&
            innerUnsubscriptions.length === 0 &&
            rootSubscriptions.length === 0 &&
            rootUnsubscriptions.length === 0
        ) {
            return undefined;
        }

        return {
            innerSubscriptions,
            innerUnsubscriptions,
            rootSubscriptions: rootSubscriptions.map(s => s.outer),
            rootUnsubscriptions: rootUnsubscriptions.map(s => s.outer)
        };
    }

    private findInnerSubscriptions_(
        snapshot: Snapshot,
        subscriptionRecord: SweptSubscriptionRecord
    ): void {

        const { inners } = subscriptionRecord;

        snapshot.subscriptions.forEach(s => {
            s.inners.forEach(i => {
                const { subscription } = i;
                if (!subscription.closed) {
                    inners.set(subscription, i);
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
                        inners: new Map<Subscription, SubscriptionSnapshot>(),
                        outer: subscriptionSnapshot
                    };
                    this.findInnerSubscriptions_(snapshot, subscriptionRecord);
                    rootSubscriptions.set(subscription, subscriptionRecord);
                }
            });
        });
    }

    private record_(snapshot: Snapshot): SweptSnapshotRecord {

        const roots = new Map<Subscription, SweptSubscriptionRecord>();
        this.findRootSubscriptions_(snapshot, roots);

        return { roots, snapshot };
    }
}
