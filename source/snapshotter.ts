/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";
import { Subscriber } from "rxjs/Subscriber";
import { read } from "./operator/tag";
import { empty, Plugin } from "./plugin";
import { attach, detach, tick } from "./spy";

export interface Snapshot {
    observables: SnapshotObservable[];
    tick: number;
}

export interface SnapshotObservable {
    complete: boolean;
    dependencies: SnapshotObservable[];
    dependents: SnapshotObservable[];
    error: any;
    observable: Observable<any>;
    subscriptions: SnapshotSubscription[];
    tag: string | null;
    tick: number;
    values: { timestamp: number; value: any; }[];
}

export interface SnapshotSubscription {
    explicit: boolean;
    subscriber: Subscriber<any>;
    timestamp: number;
    values: { timestamp: number; value: any; }[];
}

export class Snapshotter {

    private observables_: SnapshotObservable[] = [];
    private plugin_: Plugin;
    private subscribing_: SnapshotObservable[] = [];

    constructor() {

        this.plugin_ = empty();
        this.plugin_.afterSubscribe = (observable, subscriber) => this.afterSubscribe_(observable);
        this.plugin_.beforeComplete = (observable, subscriber) => this.beforeComplete_(observable);
        this.plugin_.beforeError = (observable, subscriber, error) => this.beforeError_(observable, error);
        this.plugin_.beforeNext = (observable, subscriber, value) => this.beforeNext_(observable, subscriber, value);
        this.plugin_.beforeSubscribe = (observable, subscriber) => this.beforeSubscribe_(observable, subscriber);
        this.plugin_.beforeUnsubscribe = (observable, subscriber) => this.beforeUnsubscribe_(observable, subscriber);
        this.attach();
    }

    attach(): void {

        attach(this.plugin_);
    }

    detach(): void {

        detach(this.plugin_);
    }

    flush(options?: {
        completed?: boolean,
        errored?: boolean
    }): void {

        const { completed, errored } = options || {
            completed: true,
            errored: true
        };

        this.observables_ = this.observables_.filter((o) => !((completed && o.complete) || (errored && o.error)));
    }

    snapshot({
        filter,
        since
    }: {
        filter?: (o: SnapshotObservable) => boolean,
        since?: Snapshot
    } = {}): Snapshot {

        let observables = this.observables_.map(clone);
        observables.forEach((o) => {
            o.dependencies = o.dependencies.map(findClone);
            o.dependents = o.dependents.map(findClone);
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

    private afterSubscribe_(observable: Observable<any>): void {

        const { subscribing_ } = this;
        subscribing_.pop();
    }

    private beforeComplete_(observable: Observable<any>): void {

        const { observables_ } = this;

        const snapshotObservable = observables_.find((o) => o.observable === observable);
        if (!snapshotObservable) {
            throw new Error("Snapshot not found.");
        }

        snapshotObservable.complete = true;
        snapshotObservable.subscriptions = [];
        snapshotObservable.tick = tick();
    }

    private beforeError_(observable: Observable<any>, error: any): void {

        const { observables_ } = this;

        const snapshotObservable = observables_.find((o) => o.observable === observable);
        if (!snapshotObservable) {
            throw new Error("Snapshot not found.");
        }

        snapshotObservable.error = error;
        snapshotObservable.subscriptions = [];
        snapshotObservable.tick = tick();
    }

    private beforeNext_(observable: Observable<any>, subscriber: Subscriber<any>, value: any): void {

        const { observables_ } = this;
        const timestamp = Date.now();

        const snapshotObservable = observables_.find((o) => o.observable === observable);
        if (!snapshotObservable) {
            throw new Error("Snapshot not found.");
        }

        const snapshotSubscription = snapshotObservable.subscriptions.find((s) => s.subscriber === subscriber);
        if (!snapshotSubscription) {
            throw new Error("Snapshot not found.");
        }

        snapshotObservable.tick = tick();
        snapshotObservable.values.push({ timestamp, value });
        snapshotSubscription.timestamp = timestamp;
        snapshotSubscription.values.push({ timestamp, value });
    }

    private beforeSubscribe_(observable: Observable<any>, subscriber: Subscriber<any>): void {

        const { observables_, subscribing_ } = this;

        let snapshotObservable = observables_.find((o) => o.observable === observable);
        if (snapshotObservable) {
            snapshotObservable.tick = tick();
        } else {
            const tag = read(observable);
            snapshotObservable = {
                complete: false,
                dependencies: [],
                dependents: [],
                error: null,
                observable,
                subscriptions: [],
                tag,
                tick: tick(),
                values: []
            };
            observables_.push(snapshotObservable);
        }

        if (subscribing_.length > 0) {
            const dependent = subscribing_[subscribing_.length - 1];
            addOnce(dependent.dependencies, snapshotObservable);
            addOnce(snapshotObservable.dependents, dependent);
        }
        subscribing_.push(snapshotObservable);

        const snapshotSubscription: SnapshotSubscription = {
            explicit: subscribing_.length === 1,
            subscriber,
            timestamp: Date.now(),
            values: []
        };
        snapshotObservable.subscriptions.push(snapshotSubscription);
    }

    private beforeUnsubscribe_(observable: Observable<any>, subscriber: Subscriber<any>): void {

        const { observables_ } = this;

        const snapshotObservable = observables_.find((o) => o.observable === observable);
        if (!snapshotObservable) {
            throw new Error("Snapshot not found.");
        }

        snapshotObservable.subscriptions = snapshotObservable.subscriptions.filter((s) => s.subscriber !== subscriber);
    }
}

function addOnce<T>(array: T[], element: T): void {

    const found = array.indexOf(element);
    if (found === -1) {
        array.push(element);
    }
}
