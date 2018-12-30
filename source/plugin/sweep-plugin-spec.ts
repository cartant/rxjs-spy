/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { BehaviorSubject, Subject } from "rxjs";
import { mergeMap } from "rxjs/operators";
import { create } from "../factory";
import { tag } from "../operators";
import { Spy } from "../spy";
import { SweepPlugin } from "./sweep-plugin";

const options = {
    keptDuration: -1,
    keptValues: 4,
    warning: false
};

describe("SweepPlugin", () => {

    let spy: Spy;
    let sweepPlugin: SweepPlugin;

    beforeEach(() => {

        spy = create({ ...options });
        sweepPlugin = new SweepPlugin({ id: "", pluginHost: spy });
        spy.plug(sweepPlugin);
    });

    it("should find subscriptions and unsubscriptions", () => {

        const subject = new Subject<number>();
        const source = subject.pipe(tag("source"));

        subject.next();

        let swept = sweepPlugin.sweep();
        expect(swept).to.not.exist;

        const subscription = source.subscribe();
        subject.next();

        swept = sweepPlugin.sweep()!;
        expect(swept.rootSubscriptions).to.have.length(1);
        expect(swept.rootUnsubscriptions).to.be.empty;

        subscription.unsubscribe();
        subject.next();

        swept = sweepPlugin.sweep()!;
        expect(swept.rootSubscriptions).to.be.empty;
        expect(swept.rootUnsubscriptions).to.have.length(1);
    });

    it("should find inner subscriptions and unsubscriptions", () => {

        const subject = new Subject<number>();
        const source = subject.pipe(tag("source"));
        const merged = source.pipe(
            mergeMap(value => new BehaviorSubject<number>(value).pipe(tag("merge")))
        );

        subject.next();

        let swept = sweepPlugin.sweep();
        expect(swept).to.not.exist;

        const subscription = merged.subscribe();
        subject.next();

        swept = sweepPlugin.sweep()!;
        expect(swept.innerSubscriptions).to.have.length(1);
        expect(swept.innerUnsubscriptions).to.be.empty;

        subject.next();

        swept = sweepPlugin.sweep()!;
        expect(swept).to.exist;
        expect(swept.innerSubscriptions).to.have.length(1);
        expect(swept.innerUnsubscriptions).to.be.empty;

        subscription.unsubscribe();
    });

    it("should support flush", () => {

        const subject = new Subject<number>();
        const source = subject.pipe(tag("source"));

        subject.next();

        let swept = sweepPlugin.sweep();
        expect(swept).to.not.exist;

        const subscription = source.subscribe();
        subject.next();

        swept = sweepPlugin.sweep()!;
        expect(swept.rootSubscriptions).to.have.length(1);
        expect(swept.rootUnsubscriptions).to.be.empty;

        subscription.unsubscribe();
        subject.next();

        swept = sweepPlugin.sweep({ flush: true })!;
        expect(swept).to.not.exist;
    });

    afterEach(() => {

        if (spy) {
            spy.teardown();
        }
    });
});
