/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { BehaviorSubject, Subject } from "rxjs";
import { mergeMap } from "rxjs/operators";
import { Detector } from "./detector";
import { tag } from "./operators";
import { create } from "./spy-factory";
import { Spy } from "./spy-interface";

const options = {
    keptDuration: -1,
    keptValues: 4,
    warning: false
};

describe("detector", () => {

    let detector: Detector;
    let spy: Spy;

    beforeEach(() => {

        spy = create({ ...options });
        detector = new Detector(spy);
    });

    it("should detect subscriptions and unsubscriptions", () => {

        const subject = new Subject<number>();
        const source = subject.pipe(tag("source"));

        subject.next();

        const id = "";
        let detected = detector.detect(id);
        expect(detected).to.not.exist;

        const subscription = source.subscribe();
        subject.next();

        detected = detector.detect(id)!;
        expect(detected.subscriptions).to.have.length(1);
        expect(detected.unsubscriptions).to.be.empty;

        subscription.unsubscribe();
        subject.next();

        detected = detector.detect(id)!;
        expect(detected.subscriptions).to.be.empty;
        expect(detected.unsubscriptions).to.have.length(1);
    });

    it("should detect flat subscriptions and unsubscriptions", () => {

        const subject = new Subject<number>();
        const source = subject.pipe(tag("source"));
        const merged = source.pipe(
            mergeMap((value) => new BehaviorSubject<number>(value).pipe(tag("merge")))
        );
        const subscription = merged.subscribe();

        subject.next();

        const id = "";
        let detected = detector.detect(id);
        expect(detected).to.not.exist;

        subject.next();

        detected = detector.detect(id)!;
        expect(detected.flatSubscriptions).to.have.length(1);
        expect(detected.flatUnsubscriptions).to.be.empty;

        subject.next();

        detected = detector.detect(id)!;
        expect(detected).to.exist;
        expect(detected.flatSubscriptions).to.have.length(1);
        expect(detected.flatUnsubscriptions).to.be.empty;

        subscription.unsubscribe();
    });

    afterEach(() => {

        if (spy) {
            spy.teardown();
        }
    });
});
