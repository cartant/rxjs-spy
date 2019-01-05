/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { concat, NEVER, of } from "rxjs";
import { share } from "rxjs/operators";
import { patch } from "./factory";
import { hide } from "./operators";
import { Patcher } from "./patcher";

const options = {
    defaultPlugins: true,
    keptDuration: -1,
    keptValues: 4,
    warning: false
};

describe("issues", () => {

    let patcher: Patcher;

    beforeEach(() => {

        patcher = patch(options);
    });

    describe("37", () => {

        it("should resubscribe to a shared source", () => {

            const source = concat(of("foo"), NEVER);
            const shared = source.pipe(share());

            const values: string[] = [];
            let subscription = shared.subscribe(value => values.push(value));
            subscription.unsubscribe();

            expect(values).to.deep.equal(["foo"]);

            subscription = shared.subscribe(value => values.push(value));
            subscription.unsubscribe();

            expect(values).to.deep.equal(["foo", "foo"]);
        });

        it("should resubscribe to a hidden, shared source", () => {

            const source = concat(of("foo"), NEVER);
            const shared = source.pipe(share(), hide());

            const values: string[] = [];
            let subscription = shared.subscribe(value => values.push(value));
            subscription.unsubscribe();

            expect(values).to.deep.equal(["foo"]);

            subscription = shared.subscribe(value => values.push(value));
            subscription.unsubscribe();

            expect(values).to.deep.equal(["foo", "foo"]);
        });
    });

    afterEach(() => {

        if (patcher) {
            patcher.teardown();
        }
    });
});
