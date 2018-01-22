/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { Observable } from "rxjs/Observable";
import { hidden } from "./hidden";

import "rxjs/add/observable/from";
import "./add/operator/hide";

describe("hidden", () => {

    it("should return true if hidden", () => {

        expect(hidden(Observable.from([]).hide())).to.be.true;
    });

    it("should return false if not hidden", () => {

        expect(hidden(Observable.from([]))).to.be.false;
    });
});
