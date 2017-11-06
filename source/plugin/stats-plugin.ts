/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";
import { Subscriber } from "rxjs/Subscriber";
import { BasePlugin, Notification, SubscriberRef, SubscriptionRef } from "./plugin";
import { tick } from "../tick";

export interface Stats {
    completes: number;
    errors: number;
    nexts: number;
    subscribes: number;
    tick: number;
    timespan: number;
    unsubscribes: number;
}

export class StatsPlugin extends BasePlugin {

    private stats_: Stats = {
        completes: 0,
        errors: 0,
        nexts: 0,
        subscribes: 0,
        tick: 0,
        timespan: 0,
        unsubscribes: 0
    };
    private time_ = 0;

    beforeComplete(ref: SubscriptionRef): void {
        const { stats_ } = this;
        ++stats_.completes;
        this.all_();
    }

    beforeError(ref: SubscriptionRef, error: any): void {
        const { stats_ } = this;
        ++stats_.errors;
        this.all_();
    }

    beforeNext(ref: SubscriptionRef, value: any): void {
        const { stats_ } = this;
        ++stats_.nexts;
        this.all_();
    }

    beforeSubscribe(ref: SubscriberRef): void {
        const { stats_ } = this;
        ++stats_.subscribes;
        this.all_();
    }

    beforeUnsubscribe(ref: SubscriptionRef): void {
        const { stats_ } = this;
        ++stats_.unsubscribes;
        this.all_();
    }

    public get stats(): Stats {
        const { stats_ } = this;
        return { ...stats_ };
    }

    private all_(): void {
        const { stats_, time_ } = this;
        if (time_ === 0) {
            this.time_ = Date.now();
        } else {
            stats_.timespan = Date.now() - time_;
        }
        stats_.tick = tick();
    }
}
