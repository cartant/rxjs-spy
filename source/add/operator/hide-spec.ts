/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { Observable } from "rxjs/Observable";

import "rxjs/add/observable/from";
import "rxjs/add/operator/toArray";
import "rxjs/add/operator/toPromise";
import "./hide";

describe("hide", () => {

    it("should attach a hide operator", () => {

        const source = Observable
            .from(["alice", "bob"])
            .hide();

        expect(source).to.have.property("operator");
        expect(source["operator"]).to.have.property("hide", true);
    });

    it("should do nothing else", () => {

        return Observable
            .from(["alice", "bob"])
            .hide()
            .toArray()
            .toPromise()
            .then(value => expect(value).to.deep.equal(["alice", "bob"]));
    });
});
