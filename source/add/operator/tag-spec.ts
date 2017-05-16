/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { Observable } from "rxjs/Observable";
import { tag, tagged } from "../../operator/tag";

import "rxjs/add/observable/from";
import "rxjs/add/observable/of";
import "rxjs/add/operator/toArray";
import "rxjs/add/operator/toPromise";
import "./tag";

describe("tag", () => {

    it("should attach a tag", () => {

        const source = Observable
            .from(["alice", "bob"])
            .tag("people");

        expect(source).to.have.property("operator");
        expect(source["operator"]).to.have.property("tag", "people");
    });

    it("should do nothing else", () => {

        return Observable
            .from(["alice", "bob"])
            .tag("people")
            .toArray()
            .toPromise()
            .then((value) => {

                expect(value).to.deep.equal(["alice", "bob"]);
            });
    });
});

describe("tagged", () => {

    let source: Observable<string>;

    beforeEach(() => {

        source = Observable
            .from(["alice", "bob"])
            .tag("people");
    });

    it("should match a string", () => {

        expect(tagged(source, "people")).to.be.true;
        expect(tagged(Observable.of("mallory"), "people")).to.be.false;
    });

    it("should match a regular expression", () => {

        expect(tagged(source, /^people$/)).to.be.true;
        expect(tagged(Observable.of("mallory"), /^people$/)).to.be.false;
    });

    it("should match a predicate", () => {

        function predicate(tag: string): boolean {
            return tag === "people";
        }

        expect(tagged(source, predicate)).to.be.true;
        expect(tagged(Observable.of("mallory"), predicate)).to.be.false;
    });
});
