/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { Observable } from "rxjs/Observable";
import { Subject } from "rxjs/Subject";
import { GraphPlugin } from "./graph-plugin";
import { StatsPlugin } from "./stats-plugin";
import { create } from "../spy-factory";
import { Spy } from "../spy-interface";

import "rxjs/add/observable/never";
import "rxjs/add/observable/timer";
import "rxjs/add/operator/map";
import "rxjs/add/operator/switchMap";

describe("StatsPlugin", () => {

    let spy: Spy;
    let statsPlugin: StatsPlugin;

    afterEach(() => {

        if (spy) {
            spy.teardown();
        }
    });

    beforeEach(() => {

        spy = create({ defaultPlugins: false, warning: false });
        statsPlugin = new StatsPlugin(spy);
        spy.plug(new GraphPlugin({ keptDuration: -1 }), statsPlugin);
    });

    it("should count subscribes/unsubscribes", () => {

        const subject = new Subject<number>();

        let stats = statsPlugin.stats;
        expect(stats.subscribes).to.equal(0);
        expect(stats.unsubscribes).to.equal(0);

        const subscription = subject.subscribe();

        stats = statsPlugin.stats;
        expect(stats.subscribes).to.equal(1);
        expect(stats.unsubscribes).to.equal(0);

        subscription.unsubscribe();

        stats = statsPlugin.stats;
        expect(stats.subscribes).to.equal(1);
        expect(stats.unsubscribes).to.equal(1);
    });

    it("should count root/leaf subscribes", () => {

        const subject = new Subject<number>();
        const mapped = subject.map(value => value);

        let stats = statsPlugin.stats;
        expect(stats.subscribes).to.equal(0);
        expect(stats.rootSubscribes).to.equal(0);
        expect(stats.leafSubscribes).to.equal(0);
        expect(stats.unsubscribes).to.equal(0);

        const subscription = mapped.subscribe();

        stats = statsPlugin.stats;
        expect(stats.subscribes).to.equal(2);
        expect(stats.rootSubscribes).to.equal(1);
        expect(stats.leafSubscribes).to.equal(1);
        expect(stats.unsubscribes).to.equal(0);

        subscription.unsubscribe();

        stats = statsPlugin.stats;
        expect(stats.subscribes).to.equal(2);
        expect(stats.rootSubscribes).to.equal(1);
        expect(stats.leafSubscribes).to.equal(1);
        expect(stats.unsubscribes).to.equal(2);
    });

    it("should count flattened subscribes", () => {

        const subject = new Subject<number>();
        const mapped = subject.switchMap(value => Observable.never<number>());

        let stats = statsPlugin.stats;
        expect(stats.subscribes).to.equal(0);
        expect(stats.rootSubscribes).to.equal(0);
        expect(stats.flattenedSubscribes).to.equal(0);
        expect(stats.unsubscribes).to.equal(0);

        const subscription = mapped.subscribe();

        stats = statsPlugin.stats;
        expect(stats.subscribes).to.equal(2);
        expect(stats.rootSubscribes).to.equal(1);
        expect(stats.flattenedSubscribes).to.equal(0);
        expect(stats.unsubscribes).to.equal(0);

        subject.next(0);

        stats = statsPlugin.stats;
        expect(stats.subscribes).to.equal(3);
        expect(stats.rootSubscribes).to.equal(1);
        expect(stats.flattenedSubscribes).to.equal(1);
        expect(stats.unsubscribes).to.equal(0);

        subscription.unsubscribe();

        stats = statsPlugin.stats;
        expect(stats.subscribes).to.equal(3);
        expect(stats.rootSubscribes).to.equal(1);
        expect(stats.flattenedSubscribes).to.equal(1);
        expect(stats.unsubscribes).to.equal(3);
    });

    it("should count completes", () => {

        const subject = new Subject<number>();
        const subscription = subject.subscribe();

        let stats = statsPlugin.stats;
        expect(stats.completes).to.equal(0);

        subject.complete();

        stats = statsPlugin.stats;
        expect(stats.completes).to.equal(1);
    });

    it("should count errors", () => {

        const subject = new Subject<number>();
        const subscription = subject.subscribe();

        let stats = statsPlugin.stats;
        expect(stats.errors).to.equal(0);

        subject.error(new Error("Boom!"));

        stats = statsPlugin.stats;
        expect(stats.errors).to.equal(1);
    });

    it("should count nexts", () => {

        const subject = new Subject<number>();
        const subscription = subject.subscribe();

        let stats = statsPlugin.stats;
        expect(stats.nexts).to.equal(0);

        subject.next(1);

        stats = statsPlugin.stats;
        expect(stats.nexts).to.equal(1);
    });

    it("should include the tick", () => {

        const subject = new Subject<number>();
        const subscription = subject.subscribe();

        subject.next(1);

        const stats = statsPlugin.stats;
        expect(stats.tick).to.not.equal(0);
    });

    it("should determine the timespan between the first and last notification", (callback: any) => {

        Observable.timer(10).subscribe(
            () => {
                const stats = statsPlugin.stats;
                expect(stats.timespan).to.not.be.below(10);
            },
            callback,
            callback
        );
    });

    it("should determine the maximum and total depth", () => {

        const subject = new Subject<number>();
        const mapped = subject.map(value => value);
        const remapped = mapped.map(value => value);

        let stats = statsPlugin.stats;
        expect(stats.subscribes).to.equal(0);
        expect(stats.rootSubscribes).to.equal(0);
        expect(stats.unsubscribes).to.equal(0);

        const mappedSubscription = mapped.subscribe();

        stats = statsPlugin.stats;
        expect(stats.subscribes).to.equal(2);
        expect(stats.unsubscribes).to.equal(0);
        expect(stats.maxDepth).to.equal(2);
        expect(stats.totalDepth).to.equal(2);

        const remappedSubscription = remapped.subscribe();

        stats = statsPlugin.stats;
        expect(stats.subscribes).to.equal(5);
        expect(stats.unsubscribes).to.equal(0);
        expect(stats.maxDepth).to.equal(3);
        expect(stats.totalDepth).to.equal(5);

        mappedSubscription.unsubscribe();
        remappedSubscription.unsubscribe();

        stats = statsPlugin.stats;
        expect(stats.subscribes).to.equal(5);
        expect(stats.unsubscribes).to.equal(5);
        expect(stats.maxDepth).to.equal(3);
        expect(stats.totalDepth).to.equal(5);
    });
});
