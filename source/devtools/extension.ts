/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Message, Post } from "./messages";

export interface Connection {
    disconnect(): void;
    post(message: Message): Post;
    subscribe(next: (message: Post) => void): { unsubscribe(): void };
}

export interface Extension {
    connect(options: { version: string }): Connection;
}
