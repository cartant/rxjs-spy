/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { Observable } from "rxjs/Observable";
import * as sinon from "sinon";
import { identify } from "./identify";
import { matches, read, toString } from "./match";

import "rxjs/add/observable/from";
import "rxjs/add/observable/of";
import "./add/operator/tag";

describe("match", () => {

    describe("matches", () => {

        let source: Observable<string>;

        beforeEach(() => {

            source = Observable
                .from(["alice", "bob"])
                .tag("people");
        });

        it("should match an observable", () => {

            expect(matches(source, source)).to.be.true;
            expect(matches(Observable.of("mallory"), source)).to.be.false;
        });

        it("should match a string tag", () => {

            expect(matches(source, "people")).to.be.true;
            expect(matches(Observable.of("mallory"), "people")).to.be.false;
        });

        it("should match a string identity", () => {

            const identity = identify(source);
            expect(matches(source, identity)).to.be.true;
            expect(matches(Observable.of("mallory"), identity)).to.be.false;
        });

        it("should match a regular expression", () => {

            expect(matches(source, /^people$/)).to.be.true;
            expect(matches(Observable.of("mallory"), /^people$/)).to.be.false;
        });

        it("should match a predicate", () => {

            function predicate(tag: string | undefined): boolean {
                return tag === "people";
            }

            expect(matches(source, predicate)).to.be.true;
            expect(matches(Observable.of("mallory"), predicate)).to.be.false;
        });

        it("should pass the observable to the predicate", () => {

            const stub = sinon.stub().returns(true);

            matches(source, stub);

            expect(stub).to.have.property("calledOnce", true);
            expect(stub.calledWith("people", source)).to.be.true;
        });
    });

    describe.skip("read", () => {
    });

    describe.skip("toString", () => {
    });
});
