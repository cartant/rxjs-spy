/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { Observable } from "rxjs/Observable";
import { Subject } from "rxjs/Subject";
import { getStackTrace, StackTracePlugin } from "./stack-trace-plugin";
import { BasePlugin, SubscriptionRef } from "./plugin";
import { spy } from "../spy";

import "rxjs/add/operator/map";

describe("StackTracePlugin", () => {

    let plugin: StackTracePlugin;
    let subscriptionRefs: Map<Observable<any>, SubscriptionRef>;
    let teardown: () => void;

    afterEach(() => {

        if (teardown) {
            teardown();
        }
    });

    beforeEach(() => {

        class SubscriptionRefsPlugin extends BasePlugin {
            beforeSubscribe(ref: SubscriptionRef): void { subscriptionRefs.set(ref.observable, ref); }
        }
        subscriptionRefs = new Map<Observable<any>, SubscriptionRef>();

        plugin = new StackTracePlugin();
        teardown = spy({ plugins: [plugin, new SubscriptionRefsPlugin()], warning: false });
    });

    it("should determine the stack traces", () => {

        const subject = new Subject<number>();
        const mapped = subject.map((value) => value);
        const subscription = mapped.subscribe();

        const subjectSubscriptionRef = subscriptionRefs.get(subject)!;
        const mappedSubscriptionRef = subscriptionRefs.get(mapped)!;

        const subjectStackTrace = getStackTrace(subjectSubscriptionRef);
        const mappedStackTrace = getStackTrace(mappedSubscriptionRef);

        expect(subjectStackTrace).to.exist;
        expect(subjectStackTrace).to.not.be.empty;

        expect(mappedStackTrace).to.exist;
        expect(mappedStackTrace).to.not.be.empty;
    });
});
