/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { from } from "rxjs";
import { toArray } from "rxjs/operators";
import { hide } from "./hide";

describe("hide", () => {

    it("should attach a hide operator", () => {

        const source = from(["alice", "bob"]).pipe(hide());

        expect(source).to.have.property("operator");
        expect(source["operator"]).to.have.property("hide", true);
    });

    it("should do nothing else", () => {

        return from(["alice", "bob"])
            .pipe(hide(), toArray())
            .toPromise()
            .then(value => expect(value).to.deep.equal(["alice", "bob"]));
    });
});
