/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { Observable } from "rxjs/Observable";
import { Subject } from "rxjs/Subject";
import { LogPlugin } from "./log-plugin";
import { spy } from "../spy";

import "../add/operator/tag";

describe("LogPlugin", () => {

    let calls: any[][];
    let teardown: () => void;

    afterEach(() => {

        if (teardown) {
            teardown();
        }
    });

    beforeEach(() => {

        const plugin = new LogPlugin("people", {
            log(...args: any[]): void { calls.push(args); }
        });
        teardown = spy({ plugins: [plugin] });
        calls = [];
    });

    it("should log subscribe/next/unsubscribe", () => {

        const subject = new Subject<string>();

        const subscription = subject.tag("people").subscribe();
        expect(calls).to.have.length(1);
        expect(calls[0]).to.deep.equal(["subscribe: people"]);

        subject.next("alice");
        expect(calls).to.have.length(2);
        expect(calls[1]).to.deep.equal(["next: people", "alice"]);

        subscription.unsubscribe();
        expect(calls).to.have.length(3);
        expect(calls[2]).to.deep.equal(["unsubscribe: people"]);
    });

    it("should log complete", () => {

        const subject = new Subject<string>();

        const subscription = subject.tag("people").subscribe();
        expect(calls).to.have.length(1);
        expect(calls[0]).to.deep.equal(["subscribe: people"]);

        subject.complete();
        expect(calls).to.have.length(2);
        expect(calls[1]).to.deep.equal(["complete: people"]);
    });

    it("should log error", () => {

        const subject = new Subject<string>();

        const subscription = subject.tag("people").subscribe((value) => {}, (error) => {});
        expect(calls).to.have.length(1);
        expect(calls[0]).to.deep.equal(["subscribe: people"]);

        const error = new Error("Boom!");
        subject.error(error);
        expect(calls).to.have.length(2);
        expect(calls[1]).to.deep.equal(["error: people", error]);
    });

    it("should ignore untagged observables", () => {

        const subject = new Subject<string>();

        const subscription = subject.subscribe();
        expect(calls).to.have.length(0);

        subject.next("alice");
        expect(calls).to.have.length(0);

        subscription.unsubscribe();
        expect(calls).to.have.length(0);
    });
});
