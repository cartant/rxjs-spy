/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";
import { Subscriber } from "rxjs/Subscriber";
import { read } from "../operator/tag";
import { Event, BasePlugin } from "./plugin";
import { tick } from "../spy";

export interface Snapshot {
    observables: SnapshotObservable[];
    tick: number;
}

export interface SnapshotObservable {
    complete: boolean;
    dependencies: SnapshotObservable[];
    dependents: SnapshotObservable[];
    error: any;
    merges: SnapshotObservable[];
    observable: Observable<any>;
    subscriptions: SnapshotSubscription[];
    tag: string | null;
    tick: number;
    type: string;
    values: { timestamp: number; value: any; }[];
}

export interface SnapshotSubscription {
    explicit: boolean;
    subscriber: Subscriber<any>;
    timestamp: number;
    values: { timestamp: number; value: any; }[];
}

export class SnapshotPlugin extends BasePlugin {

    private snapshotObservables_: SnapshotObservable[] = [];
    private stack_: { event: Event, snapshotObservable: SnapshotObservable }[] = [];

    afterComplete(observable: Observable<any>, subscriber: Subscriber<any>): void {

        const { stack_ } = this;
        stack_.pop();
    }

    afterError(observable: Observable<any>, subscriber: Subscriber<any>, error: any): void {

        const { stack_ } = this;
        stack_.pop();
    }

    afterNext(observable: Observable<any>, subscriber: Subscriber<any>, value: any): void {

        const { stack_ } = this;
        stack_.pop();
    }

    afterSubscribe(observable: Observable<any>, subscriber: Subscriber<any>): void {

        const { stack_ } = this;
        stack_.pop();
    }

    afterUnsubscribe(observable: Observable<any>, subscriber: Subscriber<any>): void {

        const { stack_ } = this;
        stack_.pop();
    }

    beforeComplete(observable: Observable<any>, subscriber: Subscriber<any>): void {

        const { snapshotObservables_, stack_ } = this;

        const snapshotObservable = snapshotObservables_.find((o) => o.observable === observable);
        if (!snapshotObservable) {
            throw new Error("Snapshot not found.");
        }
        stack_.push({ event: "complete", snapshotObservable });

        snapshotObservable.complete = true;
        snapshotObservable.subscriptions = [];
        snapshotObservable.tick = tick();
    }

    beforeError(observable: Observable<any>, subscriber: Subscriber<any>, error: any): void {

        const { snapshotObservables_, stack_ } = this;

        const snapshotObservable = snapshotObservables_.find((o) => o.observable === observable);
        if (!snapshotObservable) {
            throw new Error("Snapshot not found.");
        }
        stack_.push({ event: "error", snapshotObservable });

        snapshotObservable.error = error;
        snapshotObservable.subscriptions = [];
        snapshotObservable.tick = tick();
    }

    beforeNext(observable: Observable<any>, subscriber: Subscriber<any>, value: any): void {

        const { snapshotObservables_, stack_ } = this;
        const timestamp = Date.now();

        const snapshotObservable = snapshotObservables_.find((o) => o.observable === observable);
        if (!snapshotObservable) {
            throw new Error("Snapshot not found.");
        }
        stack_.push({ event: "next", snapshotObservable });

        const snapshotSubscription = snapshotObservable.subscriptions.find((s) => s.subscriber === subscriber);
        if (!snapshotSubscription) {
            throw new Error("Snapshot not found.");
        }

        snapshotObservable.tick = tick();
        snapshotObservable.values.push({ timestamp, value });
        snapshotSubscription.timestamp = timestamp;
        snapshotSubscription.values.push({ timestamp, value });
    }

    beforeSubscribe(observable: Observable<any>, subscriber: Subscriber<any>): void {

        const { snapshotObservables_, stack_ } = this;

        let snapshotObservable = snapshotObservables_.find((o) => o.observable === observable);
        if (snapshotObservable) {
            snapshotObservable.tick = tick();
        } else {
            const tag = read(observable);
            snapshotObservable = {
                complete: false,
                dependencies: [],
                dependents: [],
                error: null,
                merges: [],
                observable,
                subscriptions: [],
                tag,
                tick: tick(),
                type: getType(observable),
                values: []
            };
            snapshotObservables_.push(snapshotObservable);
        }

        let explicit = true;
        if ((stack_.length > 0) && (stack_[stack_.length - 1].event === "next")) {
            explicit = false;
            const source = stack_[stack_.length - 1].snapshotObservable;
            addOnce(source.merges, snapshotObservable);
        } else {
            for (let s = stack_.length - 1; s > -1; --s) {
                if (stack_[s].event === "subscribe") {
                    explicit = false;
                    const dependent = stack_[s].snapshotObservable;
                    addOnce(dependent.dependencies, snapshotObservable);
                    addOnce(snapshotObservable.dependents, dependent);
                    break;
                }
            }
        }
        stack_.push({ event: "subscribe", snapshotObservable });

        const snapshotSubscription: SnapshotSubscription = {
            explicit,
            subscriber,
            timestamp: Date.now(),
            values: []
        };
        snapshotObservable.subscriptions.push(snapshotSubscription);
    }

    beforeUnsubscribe(observable: Observable<any>, subscriber: Subscriber<any>): void {

        const { snapshotObservables_, stack_ } = this;

        const snapshotObservable = snapshotObservables_.find((o) => o.observable === observable);
        if (!snapshotObservable) {
            throw new Error("Snapshot not found.");
        }
        stack_.push({ event: "unsubscribe", snapshotObservable });

        snapshotObservable.subscriptions = snapshotObservable.subscriptions.filter((s) => s.subscriber !== subscriber);
    }

    flush(options?: {
        completed?: boolean,
        errored?: boolean
    }): void {

        const { completed, errored } = options || {
            completed: true,
            errored: true
        };

        this.snapshotObservables_ = this.snapshotObservables_.filter((o) => !((completed && o.complete) || (errored && o.error)));
    }

    snapshot({
        filter,
        since
    }: {
        filter?: (o: SnapshotObservable) => boolean,
        since?: Snapshot
    } = {}): Snapshot {

        let observables = this.snapshotObservables_.map(clone);
        observables.forEach((o) => {
            o.dependencies = o.dependencies.map(findClone);
            o.dependents = o.dependents.map(findClone);
            o.merges = o.merges.map(findClone);
        });

        if (filter) {
            observables = observables.filter(filter);
        }
        if (since) {
            observables = observables.filter((o) => o.tick > since.tick);
        }
        return { observables, tick: tick() };

        function clone(o: SnapshotObservable): SnapshotObservable {
            return { ...o, subscriptions: o.subscriptions.map((s) => ({ ...s })) };
        }

        function findClone(o: SnapshotObservable): SnapshotObservable {
            return observables.find((clone) => clone.observable === o.observable) as SnapshotObservable;
        }
    }
}

function addOnce<T>(array: T[], element: T): void {

    const found = array.indexOf(element);
    if (found === -1) {
        array.push(element);
    }
}

function getType(observable: Observable<any>): string {

    const prototype = Object.getPrototypeOf(observable);
    if (prototype.constructor && prototype.constructor.name) {
        return prototype.constructor.name;
    }
    return "Object";
}
