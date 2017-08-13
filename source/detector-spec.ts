/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { BehaviorSubject } from "rxjs/BehaviorSubject";
import { Observable } from "rxjs/Observable";
import { Subject } from "rxjs/Subject";
import { Detector } from "./detector";
import { SnapshotPlugin } from "./plugin/snapshot-plugin";
import { find, spy } from "./spy";

import "rxjs/add/operator/mergeMap";

describe("detector", () => {

    let detector: Detector;
    let teardown: () => void;

    afterEach(() => {

        if (teardown) {
            teardown();
        }
    });

    beforeEach(() => {

        teardown = spy({ warning: false });
        detector = new Detector(find(SnapshotPlugin));
    });

    it("should detect unbalanced subscriptions", () => {

        const subject = new Subject<number>();
        const source = subject.tag("source");

        subject.next();

        const id = "";
        let detected = detector.detect(id);
        expect(detected).to.be.null;

        const subscription = source.subscribe();
        subject.next();

        detected = detector.detect(id);
        expect(detected).to.not.be.null;
        expect(detected!.subscriptions).to.have.length(1);

        subscription.unsubscribe();
        subject.next();

        detected = detector.detect(id);
        expect(detected).to.be.null;
    });

    it("should detect unbalanced merged subscriptions", () => {

        const subject = new Subject<number>();
        const source = subject.tag("source");
        const merged = source.mergeMap((value) => new BehaviorSubject<number>(value).tag("merge"));
        const subscription = merged.subscribe();

        subject.next();

        const id = "";
        let detected = detector.detect(id);
        expect(detected).to.be.null;

        subject.next();

        detected = detector.detect(id);
        expect(detected).to.not.be.null;
        expect(detected!.mergeSubscriptions).to.have.length(1);

        subject.next();

        detected = detector.detect(id);
        expect(detected).to.not.be.null;
        expect(detected!.mergeSubscriptions).to.have.length(1);

        subscription.unsubscribe();
    });
});
