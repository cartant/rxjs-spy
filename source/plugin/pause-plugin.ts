/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Notification } from "rxjs/Notification";
import { Observable } from "rxjs/Observable";
import { Subject } from "rxjs/Subject";
import { Subscriber } from "rxjs/Subscriber";
import { Subscription } from "rxjs/Subscription";
import { defaultLogger, Logger, PartialLogger, toLogger } from "../logger";
import { Match, matches, read, toString as matchToString } from "../match";
import { BasePlugin } from "./plugin";
import { subscribeWithoutSpy } from "../spy";

import "rxjs/add/operator/dematerialize";
import "rxjs/add/operator/materialize";

interface State {
    notifications_: Notification<any>[];
    subject_: Subject<Notification<any>>;
    subscription_: Subscription | null;
    tag_: string | null;
}

export class Deck {

    public teardown: () => void;

    private match_: Match;
    private paused_ = true;
    private states_ = new Map<Observable<any>, State>();

    constructor(match: Match) {

        this.match_ = match;
    }

    get paused(): boolean {

        return this.paused_;
    }

    clear(): void {

        this.states_.forEach((state) => {
            state.notifications_ = state.notifications_.filter((notification) => notification.kind !== "N");
        });
    }

    log(partialLogger: PartialLogger = defaultLogger): void {

        const logger = toLogger(partialLogger);

        logger.group(`Deck matching ${matchToString(this.match_)}`);
        logger.log("Paused =", this.paused_);
        this.states_.forEach((state) => {
            logger.group(`Observable; tag = ${state.tag_}`);
            logger.log("Notifications =", state.notifications_);
            logger.groupEnd();
        });
        logger.groupEnd();
    }

    pause(): void {

        this.paused_ = true;
    }

    resume(): void {

        this.states_.forEach((state) => {
            while (state.notifications_.length > 0) {
                state.subject_.next(state.notifications_.shift());
            }
        });
        this.paused_ = false;
    }

    select(observable: Observable<any>, subscriber: Subscriber<any>): (source: Observable<any>) => Observable<any> {

        return (source: Observable<any>) => {

            let state = this.states_.get(observable);
            if (state) {
                state.subscription_!.unsubscribe();
            } else {
                state = {
                    notifications_: [],
                    subject_: new Subject<Notification<any>>(),
                    subscription_: null,
                    tag_: read(observable)
                };
                this.states_.set(observable, state);
            }

            state.subscription_ = subscribeWithoutSpy.call(source.materialize(), {
                next: (notification: any) => {
                    if (this.paused_) {
                        state!.notifications_.push(notification);
                    } else {
                        state!.subject_.next(notification);
                    }
                }
            });
            return state!.subject_.asObservable().dematerialize();
        };
    }

    skip(): void {

        this.states_.forEach((state) => {
            if (state.notifications_.length > 0) {
                state.notifications_.shift();
            }
        });
    }

    step(): void {

        this.states_.forEach((state) => {
            if (state.notifications_.length > 0) {
                state.subject_.next(state.notifications_.shift());
            }
        });
    }

    unsubscribe(): void {

        this.states_.forEach((state) => {
            if (state.subscription_) {
                state.subscription_.unsubscribe();
                state.subscription_ = null;
            }
        });
    }
}

export class PausePlugin extends BasePlugin {

    private match_: Match;
    private deck_: Deck;

    constructor(match: Match) {

        super();

        this.deck_ = new Deck(match);
        this.match_ = match;
    }

    get deck(): Deck {

        const { deck_ } = this;
        return deck_;
    }

    get match(): Match {

        const { match_ } = this;
        return match_;
    }

    select(observable: Observable<any>, subscriber: Subscriber<any>): ((source: Observable<any>) => Observable<any>) | null {

        const { deck_, match_ } = this;

        if (matches(observable, match_)) {
            return deck_.select(observable, subscriber);
        }
        return null;
    }

    teardown(): void {

        const { deck_ } = this;

        if (deck_) {
            deck_.resume();
            deck_.unsubscribe();
        }
    }
}
