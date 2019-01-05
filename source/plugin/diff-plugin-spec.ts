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
import { DiffPlugin } from "./diff-plugin";

const options = {
    keptDuration: -1,
    keptValues: 4,
    warning: false
};

describe("DiffPlugin", () => {

    let diffPlugin: DiffPlugin;
    let spy: Spy;

    beforeEach(() => {

        spy = create({ ...options });
        diffPlugin = new DiffPlugin({ id: "", pluginHost: spy.pluginHost });
        spy.pluginHost.plug(diffPlugin);
    });

    it("should find subscriptions and unsubscriptions", () => {

        const subject = new Subject<number>();
        const source = subject.pipe(tag("source"));

        subject.next();

        let diff = diffPlugin.diff();
        expect(diff).to.not.exist;

        const subscription = source.subscribe();
        subject.next();

        diff = diffPlugin.diff()!;
        expect(diff.rootSubscriptions).to.have.length(1);
        expect(diff.rootUnsubscriptions).to.be.empty;

        subscription.unsubscribe();
        subject.next();

        diff = diffPlugin.diff()!;
        expect(diff.rootSubscriptions).to.be.empty;
        expect(diff.rootUnsubscriptions).to.have.length(1);
    });

    it("should find inner subscriptions and unsubscriptions", () => {

        const subject = new Subject<number>();
        const source = subject.pipe(tag("source"));
        const merged = source.pipe(
            mergeMap(value => new BehaviorSubject<number>(value).pipe(tag("merge")))
        );

        subject.next();

        let diff = diffPlugin.diff();
        expect(diff).to.not.exist;

        const subscription = merged.subscribe();
        subject.next();

        diff = diffPlugin.diff()!;
        expect(diff.innerSubscriptions).to.have.length(1);
        expect(diff.innerUnsubscriptions).to.be.empty;

        subject.next();

        diff = diffPlugin.diff()!;
        expect(diff).to.exist;
        expect(diff.innerSubscriptions).to.have.length(1);
        expect(diff.innerUnsubscriptions).to.be.empty;

        subscription.unsubscribe();
    });

    afterEach(() => {

        if (spy) {
            spy.teardown();
        }
    });
});
