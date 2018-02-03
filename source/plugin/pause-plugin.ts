/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Notification } from "rxjs/Notification";
import { Observable } from "rxjs/Observable";
import { dematerialize } from "rxjs/operator/dematerialize";
import { materialize } from "rxjs/operator/materialize";
import { Subject } from "rxjs/Subject";
import { Subscriber } from "rxjs/Subscriber";
import { Subscription } from "rxjs/Subscription";
import { defaultLogger, Logger, PartialLogger, toLogger } from "../logger";
import { Match, matches, read, toString as matchToString } from "../match";
import { hide } from "../operator/hide";
import { BasePlugin } from "./plugin";
import { Teardown } from "../spy-interface";
import { SubscriptionRef } from "../subscription-ref";

export interface DeckStats {
    notifications: number;
    paused: boolean;
}

interface State {
    notifications_: Notification<any>[];
    subject_: Subject<Notification<any>>;
    subscription_: Subscription | undefined;
    tag_: string | undefined;
}

export class Deck {

    public teardown: Teardown | undefined;

    private match_: Match;
    private paused_ = true;
    private states_ = new Map<Observable<any>, State>();
    private stats_: Subject<DeckStats>;

    constructor(match: Match) {

        this.match_ = match;
        this.stats_ = new Subject<DeckStats>();
    }

    get stats(): Observable<DeckStats> {

        return this.stats_.asObservable();
    }

    get paused(): boolean {

        return this.paused_;
    }

    clear(predicate: (notification: Notification<any>) => boolean = () => true): void {

        this.states_.forEach((state) => {
            state.notifications_ = state.notifications_.filter((notification) => !predicate(notification));
        });
        this.broadcast_();
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
        this.broadcast_();
    }

    resume(): void {

        this.states_.forEach((state) => {
            while (state.notifications_.length > 0) {
                state.subject_.next(state.notifications_.shift());
            }
        });
        this.paused_ = false;
        this.broadcast_();
    }

    select(ref: SubscriptionRef): (source: Observable<any>) => Observable<any> {

        const { observable } = ref;

        return (source: Observable<any>) => {

            let state = this.states_.get(observable);
            if (state) {
                state.subscription_!.unsubscribe();
            } else {
                state = {
                    notifications_: [],
                    subject_: new Subject<Notification<any>>(),
                    subscription_: undefined,
                    tag_: read(observable)
                };
                this.states_.set(observable, state);
            }

            state.subscription_ = hide.call(materialize.call(source)).subscribe({
                next: (notification: any) => {
                    if (this.paused_) {
                        state!.notifications_.push(notification);
                    } else {
                        state!.subject_.next(notification);
                    }
                    this.broadcast_();
                }
            });
            this.broadcast_();

            return dematerialize.call(state.subject_.asObservable());
        };
    }

    skip(): void {

        this.states_.forEach((state) => {
            if (state.notifications_.length > 0) {
                state.notifications_.shift();
            }
        });
        this.broadcast_();
    }

    step(): void {

        this.states_.forEach((state) => {
            if (state.notifications_.length > 0) {
                state.subject_.next(state.notifications_.shift());
            }
        });
        this.broadcast_();
    }

    unsubscribe(): void {
        this.states_.forEach((state) => {
            if (state.subscription_) {
                state.subscription_.unsubscribe();
                state.subscription_ = undefined;
            }
        });
        this.broadcast_();
    }

    private broadcast_(): void {

        const { paused_, states_, stats_ } = this;

        let notifications = 0;
        states_.forEach((state) => notifications += state.notifications_.length);

        stats_.next({
            notifications,
            paused: paused_
        });
    }
}

export class PausePlugin extends BasePlugin {

    private match_: Match;
    private deck_: Deck;

    constructor(match: Match) {

        super(`pause(${matchToString(match)})`);

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

    select(ref: SubscriptionRef): ((source: Observable<any>) => Observable<any>) | undefined {

        const { deck_, match_ } = this;

        if (matches(ref, match_)) {
            return deck_.select(ref);
        }
        return undefined;
    }

    teardown(): void {

        const { deck_ } = this;

        if (deck_) {
            deck_.resume();
            deck_.unsubscribe();
        }
    }
}
