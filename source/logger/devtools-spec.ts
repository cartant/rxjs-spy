/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import * as sinon from "sinon";
import { toLogger } from "./devtools";

describe("logger", () => {

    describe("warnOnce", () => {

        it("should warn only once per message", () => {

            const partialLogger = {
                log: sinon.stub(),
                warn: sinon.stub()
            };

            const logger = toLogger(partialLogger);

            logger.warnOnce("there's a problem");
            expect(partialLogger.warn.callCount).to.equal(1);

            logger.warnOnce("there's a problem");
            expect(partialLogger.warn.callCount).to.equal(1);

            logger.warnOnce("there's another problem");
            expect(partialLogger.warn.callCount).to.equal(2);
        });
    });
});
