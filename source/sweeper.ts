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

interface RootRecord {
    inners: Map<Subscription, SubscriptionSnapshot>;
    outer: SubscriptionSnapshot;
}

interface SweepRecord {
    roots: Map<Subscription, RootRecord>;
    snapshot: Snapshot;
}

type FoundPlugins = {
    snapshotPlugin: SnapshotPlugin | undefined;
};

export class Sweeper {

    private foundPlugins_: FoundPlugins | undefined;
    private sweeps_: Map<string, SweepRecord[]>;
    private spy_: Spy;

    constructor(spy: Spy) {

        this.sweeps_ = new Map<string, SweepRecord[]>();
        this.spy_ = spy;
    }

    sweep(id: string): Swept | undefined {

        const { snapshotPlugin } = this.findPlugins_();
        if (!snapshotPlugin) {
            return undefined;
        }

        const { sweeps_ } = this;
        let sweepRecords = sweeps_.get(id);
        const sweepRecord = this.record_(snapshotPlugin.snapshotAll());

        if (sweepRecords) {
            sweepRecords.push(sweepRecord);
        } else {
            sweepRecords = [sweepRecord];
            sweeps_.set(id, sweepRecords);
        }
        if (sweepRecords.length > 2) {
            sweepRecords.shift();
        }
        if (sweepRecords.length < 2) {
            return undefined;
        }

        const [previous, current] = sweepRecords;
        return this.compare_(id, previous, current);
    }

    private compare_(id: string, previous: SweepRecord, current: SweepRecord): Swept | undefined {

        const rootSubscriptions: RootRecord[] = [];
        const rootUnsubscriptions: RootRecord[] = [];
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
        rootSubscriptionSnapshot: SubscriptionSnapshot,
        rootRecord: RootRecord
    ): void {

        const { inners } = rootRecord;

        snapshot.subscriptions.forEach(s => {
            s.inners.forEach(i => {
                const { rootSink, subscription } = i;
                if ((rootSink === rootSubscriptionSnapshot) && !subscription.closed) {
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

    private findRootRecords_(
        snapshot: Snapshot,
        roots: Map<Subscription, RootRecord>
    ): void {

        snapshot.observables.forEach(observableSnapshot => {
            observableSnapshot.subscriptions.forEach(subscriptionSnapshot => {
                const { completeTimestamp, errorTimestamp, sink, subscription } = subscriptionSnapshot;
                if (!completeTimestamp && !errorTimestamp && !sink && !subscription.closed) {
                    const rootRecord = {
                        inners: new Map<Subscription, SubscriptionSnapshot>(),
                        outer: subscriptionSnapshot
                    };
                    this.findInnerSubscriptions_(snapshot, subscriptionSnapshot, rootRecord);
                    roots.set(subscription, rootRecord);
                }
            });
        });
    }

    private record_(snapshot: Snapshot): SweepRecord {

        const roots = new Map<Subscription, RootRecord>();
        this.findRootRecords_(snapshot, roots);

        return { roots, snapshot };
    }
}
