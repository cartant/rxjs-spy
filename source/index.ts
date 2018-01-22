/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import "./add/operator/tag";

export { detect } from "./detect";
export { defaultLogger, Logger, PartialLogger, toLogger } from "./logger";
export { matches } from "./match";
export { BasePlugin, Plugin } from "./plugin";
export { create } from "./spy-factory";
export { inferPath, inferType } from "./util";

import {
    DebugPlugin,
    DevToolsPlugin,
    GraphPlugin,
    LetPlugin,
    LogPlugin,
    PausePlugin,
    SnapshotPlugin,
    StackTracePlugin,
    StatsPlugin
} from "./plugin";

export const plugins = {
    DebugPlugin,
    DevToolsPlugin,
    GraphPlugin,
    LetPlugin,
    LogPlugin,
    PausePlugin,
    SnapshotPlugin,
    StackTracePlugin,
    StatsPlugin
};
