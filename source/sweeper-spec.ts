/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { BehaviorSubject, Subject } from "rxjs";
import { mergeMap } from "rxjs/operators";
import { tag } from "./operators";
import { create } from "./spy-factory";
import { Spy } from "./spy-interface";
import { Sweeper } from "./sweeper";

const options = {
    keptDuration: -1,
    keptValues: 4,
    warning: false
};

describe("sweeper", () => {

    let sweeper: Sweeper;
    let spy: Spy;

    beforeEach(() => {

        spy = create({ ...options });
        sweeper = new Sweeper(spy);
    });

    it("should find subscriptions and unsubscriptions", () => {

        const subject = new Subject<number>();
        const source = subject.pipe(tag("source"));

        subject.next();

        const id = "";
        let swept = sweeper.sweep(id);
        expect(swept).to.not.exist;

        const subscription = source.subscribe();
        subject.next();

        swept = sweeper.sweep(id)!;
        expect(swept.subscriptions).to.have.length(1);
        expect(swept.unsubscriptions).to.be.empty;

        subscription.unsubscribe();
        subject.next();

        swept = sweeper.sweep(id)!;
        expect(swept.subscriptions).to.be.empty;
        expect(swept.unsubscriptions).to.have.length(1);
    });

    it("should find flat subscriptions and unsubscriptions", () => {

        const subject = new Subject<number>();
        const source = subject.pipe(tag("source"));
        const merged = source.pipe(
            mergeMap(value => new BehaviorSubject<number>(value).pipe(tag("merge")))
        );
        const subscription = merged.subscribe();

        subject.next();

        const id = "";
        let swept = sweeper.sweep(id);
        expect(swept).to.not.exist;

        subject.next();

        swept = sweeper.sweep(id)!;
        expect(swept.flatSubscriptions).to.have.length(1);
        expect(swept.flatUnsubscriptions).to.be.empty;

        subject.next();

        swept = sweeper.sweep(id)!;
        expect(swept).to.exist;
        expect(swept.flatSubscriptions).to.have.length(1);
        expect(swept.flatUnsubscriptions).to.be.empty;

        subscription.unsubscribe();
    });

    afterEach(() => {

        if (spy) {
            spy.teardown();
        }
    });
});
