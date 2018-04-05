/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { from } from "rxjs";
import { hidden } from "./hidden";
import { hide } from "./operators";

describe("hidden", () => {

    it("should return true if hidden", () => {

        expect(hidden(from([]).pipe(hide()))).to.be.true;
    });

    it("should return false if not hidden", () => {

        expect(hidden(from([]))).to.be.false;
    });
});
