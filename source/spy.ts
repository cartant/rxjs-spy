/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";
import { Subscriber } from "rxjs/Subscriber";
import { defaultLogger, Logger, PartialLogger, toLogger } from "./logger";
import { tagged } from "./operator/tag";
import { LogPlugin, PatchPlugin, Plugin, SnapshotPlugin } from "./plugin";
import { isObservable, toSubscriber } from "./util";

const observableSubscribe = Observable.prototype.subscribe;
let plugins_: Plugin[] = [];
let tick_ = 0;

if (typeof window !== "undefined") {
    window["RxSpy"] = window["RxSpy"] || {
        log,
        patch,
        show,
        spy
    };
}

export function log(match: string, partialLogger?: PartialLogger): () => void;
export function log(match: RegExp, partialLogger?: PartialLogger): () => void;
export function log(match: (tag: string) => boolean, partialLogger?: PartialLogger): () => void;
export function log(match: any, partialLogger: PartialLogger = defaultLogger): () => void {

    const plugin = new LogPlugin(match, partialLogger);
    plugins_.push(plugin);

    return () => {

        const index = plugins_.indexOf(plugin);
        if (index !== -1) {
            plugins_.slice(index, 1);
        }
    };
}

export function patch(match: string, source: Observable<any>): () => void;
export function patch(match: string, project: (value: any) => any): () => void;
export function patch(match: string, value: any): () => void;
export function patch(match: RegExp, source: Observable<any>): () => void;
export function patch(match: RegExp, project: (value: any) => any): () => void;
export function patch(match: RegExp, value: any): () => void;
export function patch(match: (tag: string) => boolean, source: Observable<any>): () => void;
export function patch(match: (tag: string) => boolean, project: (value: any) => any): () => void;
export function patch(match: (tag: string) => boolean, value: any): () => void;
export function patch(match: any, arg: any): () => void {

    const plugin = new PatchPlugin(match, arg);
    plugins_.push(plugin);

    return () => {

        const index = plugins_.indexOf(plugin);
        if (index !== -1) {
            plugins_.slice(index, 1);
        }
    };
}

export function show(match: string, partialLogger?: PartialLogger): void;
export function show(match: RegExp, partialLogger?: PartialLogger): void;
export function show(match: (tag: string) => boolean, partialLogger?: PartialLogger): void;
export function show(match: any, partialLogger: PartialLogger = defaultLogger): void {

    const plugin = plugins_.find((plugin) => plugin instanceof SnapshotPlugin);
    if (!plugin) {
        throw new Error("Snapshotting is not enabled.");
    }

    const snapshotPlugin = plugin as SnapshotPlugin;
    const snapshot = snapshotPlugin.snapshot();
    const matches = snapshot.observables.filter((o) => tagged(o.observable, match));
    const method = (matches.length > 3) ? "groupCollapsed" : "group";

    const logger = toLogger(partialLogger);
    const tag = (typeof match === "function") ? "function" : match.toString();

    logger.group(`Snapshot(s) for ${tag}`);
    matches.forEach((o) => {

        logger[method].call(logger, o.tag || "unknown");
        logger.log(o);
        logger.groupEnd();
    });
    logger.groupEnd();
}

export function spy({ plugins }: { plugins?: Plugin[] } = {}): () => void {

    if (Observable.prototype.subscribe !== observableSubscribe) {
        throw new Error("Already spying on Observable.prototype.subscribe.");
    }
    Observable.prototype.subscribe = spySubscribe;

    if (plugins) {
        plugins_ = plugins;
    } else {
        plugins_ = [new SnapshotPlugin()];
    }

    return () => {

        plugins_ = [];
        Observable.prototype.subscribe = observableSubscribe;
    };
}

export function tick(): number {

    return tick_;
}

function patchSource(
    observable: Observable<any>,
    subscriber: Subscriber<any>
): Observable<any> {

    for (let p = plugins_.length - 1; p > -1; --p) {
        const plugin = plugins_[p];
        const patch = plugin.patch(observable, subscriber);
        if (isObservable(patch)) {
            return patch;
        }
    }
    return observable;
}

function patchValue(
    observable: Observable<any>,
    subscriber: Subscriber<any>,
    value: any
): any {

    for (let p = plugins_.length - 1; p > -1; --p) {
        const plugin = plugins_[p];
        const patch = plugin.patch(observable, subscriber);
        if (typeof patch === "function") {
            return patch(value);
        }
    }
    return value;
}

function spySubscribe(this: Observable<any>, ...args: any[]): any {

    /*tslint:disable-next-line:no-invalid-this*/
    const observable = this;
    const subscriber = toSubscriber.apply(null, args);

    ++tick_;
    plugins_.forEach((plugin) => plugin.beforeSubscribe(observable, subscriber));

    const subscription = observableSubscribe.call(patchSource(observable, subscriber),
        (value: any) => {
            value = patchValue(observable, subscriber, value);
            ++tick_;
            plugins_.forEach((plugin) => plugin.beforeNext(observable, subscriber, value));
            subscriber.next(value);
            plugins_.forEach((plugin) => plugin.afterNext(observable, subscriber, value));
        },
        (error: any) => {
            ++tick_;
            plugins_.forEach((plugin) => plugin.beforeError(observable, subscriber, error));
            subscriber.error(error);
            plugins_.forEach((plugin) => plugin.afterError(observable, subscriber, error));
        },
        () => {
            ++tick_;
            plugins_.forEach((plugin) => plugin.beforeComplete(observable, subscriber));
            subscriber.complete();
            plugins_.forEach((plugin) => plugin.afterComplete(observable, subscriber));
        }
    );

    plugins_.forEach((plugin) => plugin.afterSubscribe(observable, subscriber));

    return {
        unsubscribe(): void {
            ++tick_;
            plugins_.forEach((plugin) => plugin.beforeUnsubscribe(observable, subscriber));
            subscription.unsubscribe();
            plugins_.forEach((plugin) => plugin.afterUnsubscribe(observable, subscriber));
        }
    };
}
