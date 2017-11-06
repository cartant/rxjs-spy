/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { Observable } from "rxjs/Observable";
import { Subject } from "rxjs/Subject";
import { StatsPlugin } from "./stats-plugin";
import { spy } from "../spy";

import "rxjs/add/observable/timer";

describe("StatsPlugin", () => {

    let statsPlugin: StatsPlugin;
    let teardown: () => void;

    afterEach(() => {

        if (teardown) {
            teardown();
        }
    });

    beforeEach(() => {

        statsPlugin = new StatsPlugin();
        teardown = spy({ plugins: [statsPlugin], warning: false });
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
});
