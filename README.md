# rxjs-spy

[![GitHub License](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/cartant/rxjs-spy/blob/master/LICENSE)
[![NPM version](https://img.shields.io/npm/v/rxjs-spy.svg)](https://www.npmjs.com/package/rxjs-spy)
[![Downloads](http://img.shields.io/npm/dm/rxjs-spy.svg)](https://npmjs.org/package/rxjs-spy)
[![Build status](https://img.shields.io/travis/cartant/rxjs-spy.svg)](http://travis-ci.org/cartant/rxjs-spy)
[![dependency status](https://img.shields.io/david/cartant/rxjs-spy.svg)](https://david-dm.org/cartant/rxjs-spy)
[![devDependency Status](https://img.shields.io/david/dev/cartant/rxjs-spy.svg)](https://david-dm.org/cartant/rxjs-spy#info=devDependencies)
[![peerDependency Status](https://img.shields.io/david/peer/cartant/rxjs-spy.svg)](https://david-dm.org/cartant/rxjs-spy#info=peerDependencies)
[![Greenkeeper badge](https://badges.greenkeeper.io/cartant/rxjs-spy.svg)](https://greenkeeper.io/)

### What is it?

`rxjs-spy` is a debugging library for RxJS.

### Why might you need it?

The usual approach to debugging RxJS-based code involves sprinkling `do` operators and logging throughout composed observables. That's something that I find tedious, so I wrote this library and implemented an unobtrusive mechanism for identifying observables and logging and inspecting observable subscriptions.

If you, too, are looking for a less painful RxJS debugging experience, you might find this library useful. The engineers at Slack have adopted `rxjs-spy` and have [this to say](https://slack.engineering/growing-pains-migrating-slacks-desktop-app-to-browserview-2759690d9c7b) about it:

> You might be like, "[...] but aren't Observables impossible to debug?" And you'd have been mostly right less than a year ago. But this is JavaScript and in JavaScript, the only `const` is change. `rxjs-spy` makes debugging (i.e. logging and visualizing) streams as simple as adding a `tag`. A tagged stream can be monitored, paused, and replayed, right from the console.

For more detail regarding how the library works and what it can do, you can have a look at:

* [Debugging RxJS, Part 1: Tooling](https://medium.com/@cartant/debugging-rxjs-4f0340286dd3).
* [Debugging RxJS, Part 2: Logging](https://medium.com/@cartant/debugging-rxjs-part-2-logging-56904459f144).
* There is an online example in this repo's [GitHub pages](https://cartant.github.io/rxjs-spy/).

## Install

Install the package using NPM:

```
npm install rxjs-spy --save-dev
```

And import the functions for use with TypeScript or ES2015:

```js
import { create } from "rxjs-spy";
const spy = create();
```

Or `require` the module for use with Node or a CommonJS bundler:

```js
const rxjsSpy = require("rxjs-spy");
const spy = rxjsSpy.create();
```

Or include the UMD bundle for use as a `script`:

```html
<script src="https://unpkg.com/rxjs/bundles/Rx.min.js"></script>
<script src="https://unpkg.com/rxjs-spy"></script>
<script>
var spy = RxSpy.create();
</script>
```

## Core concepts

`rxjs-spy` introduces a `tag` operator that can be used to identify observables. It attaches a string tag to an observable; it performs no additional processing and does not alter the observable's behaviour or value in any way.

The `tag` operator can be used via a patched `Observable` prototype:

```js
import "rxjs-spy/add/operator/tag";
const source = Observable.of("some-value").tag("some-tag");
```

Or by importing the `tag` function:

```js
import { tag } from "rxjs-spy/operator/tag";
let source = Observable.of("some-value");
source = tag.call(source, "some-tag");
```

Or by using the lettable/pipeable operator:

```js
import { tag } from "rxjs-spy/operators/tag";
const source = Observable.of("some-value").pipe(tag("some-tag"));
```

The API's methods are tag-based and tags can be matched using explicit literals, regular expressions or function predicates. For example, logging for the above tag could be enabled like this:

```js
import { create } from "rxjs-spy";
const spy = create();
spy.log("some-tag");

// Or like this:
spy.log(/^some-tag$/);

// Or like this:
spy.log(tag => tag === "some-tag");
```

`rxjs-spy` exposes a module API intended to be called from code and a console API - via the `rxSpy` global - intended for interactive use via the browser's console.

## Module API

The methods in the module API are callable via imports, requires or the UMD `RxSpy` global. Most methods return a teardown function that will undo the API method's action when called.

* [`create`](#module-create)
* [`Spy.show`](#module-show)
* [`Spy.log`](#module-log)
* [`Spy.pause`](#module-pause)
* [`Spy.let`](#module-let)
* [`Spy.debug`](#module-debug)
* [`Spy.flush`](#module-flush)
* [`Spy.plug`](#module-plug)
* [`Spy.unplug`](#module-unplug)
* [`Spy.find`](#module-find)
* [`Spy.findAll`](#module-findAll)
* [`Spy.stats`](#module-stats)
* [`Spy.teardown`](#module-teardown)
* [`detect`](#module-detect)

<a name="module-create"></a>

### create

```ts
function create(options: {
    [key: string]: any,
    audit?: number,
    defaultLogger?: PartialLogger,
    defaultPlugins?: boolean,
    warning?: boolean
} = {}): Teardown
```

Calling `create` attaches the spy to `Observable.prototype.subscribe` and returns the following interface:

```ts
interface Spy {
  readonly tick: number;
  debug(match: Match, ...notifications: Notification[]): Teardown;
  find<T extends Plugin>(ctor: Ctor<T>): T | undefined;
  findAll<T extends Plugin>(ctor: Ctor<T>): T[];
  findAll(): Plugin[];
  flush(): void;
  let(match: Match, select: (source: Observable<any>) => Observable<any>, options?: Options): Teardown;
  log(match: Match, partialLogger?: PartialLogger): Teardown;
  log(partialLogger?: PartialLogger): Teardown;
  pause(match: Match): Deck;
  plug(...plugins: Plugin[]): Teardown;
  show(match: Match, partialLogger?: PartialLogger): void;
  show(partialLogger?: PartialLogger): void;
  stats(partialLogger?: PartialLogger): void;
  teardown(): void;
  unplug(...plugins: Plugin[]): void;
}

```

By default, `create` will wire up the snapshotting plugin and numerous others. However, if the `defaultPlugins` option is specified as `false`, no plugins will be wired up and the caller can wire up plugins individually using the `plug` method. For example:

```ts
import { create } from "rxjs-spy";
import { GraphPlugin, SnapshotPlugin } from "rxjs-spy/plugin";
const spy = create({ defaultPlugins: false });
spy.plug(
  new GraphPlugin({ keptDuration: -1 }),
  new SnapshotPlugin(spy, { keptValues: 1 })
);
```

If the `audit` option is specified, the logging of notifications will be audited within the specified (milliseconds) duration. Each notification source will only be logged once in each duration and the number of ignored notifications (if any) will be included in the console output. This can be useful for logging high-frequency observables. `audit` defaults to zero - i.e. no auditing.

Options passed to `create` are forwarded to the plugins, so the following can be specified:

| Option | Type | Description | Default |
| --- | --- | --- | --- |
| `keptDuration` | `number` | The number of milliseconds for which the subscription graph and snapshots should be kept after unsubscription occurs. | 30000 |
| `keptValues` | `number` | The maximum number of values that should be kept in a snapshot. | 4 |
| `sourceMaps` | `boolean` | Whether or not the `StackTracePlugin` should use source maps. | `false` |

This method returns a teardown function.

<a name="module-show"></a>

### show

```ts
interface Spy {
  show(
    match: string | RegExp | MatchPredicate | Observable<any>,
    partialLogger: PartialLogger = console
  ): void;
  show(
    partialLogger: PartialLogger = console
  ): void;
}
```

`show` will log information regarding the matching observables to the console or to the specified logger. If no `match` is specified, all tagged observables will be logged.

The logged information is retrieved from the most recent snapshot, so if snapshotting is not enabled, an error will be thrown.

<a name="module-log"></a>

### log

```ts
interface Spy {
  log(
    match: string | RegExp | MatchPredicate | Observable<any>,
    partialLogger: PartialLogger = console
  ): Teardown;
  log(
    partialLogger: PartialLogger = console
  ): Teardown;
}
```

Wires up an instance of the log plugin for matching observables. If no `match` is specified, all tagged observables will be logged.

All `subscribe`, `next`, `complete`, `error` and `unsubscribe` notifications will be logged to the console or to the specified logger.

This method returns a teardown function.

<a name="module-pause"></a>

### pause

```ts
interface Spy {
  pause(
    match: string | RegExp | MatchPredicate | Observable<any>
  ): Deck;
}
```

Wires up an instance of the pause plugin for matching observables.

All subscriptions to matching observables will be placed into a paused state and notifications that would otherwise be emitted will be buffered inside the plugin.

This method returns a `Deck` instance that can be used to `resume` and `pause` the observables.

```ts
interface Deck {
  readonly paused: boolean;
  clear(): void;
  log(partialLogger: PartialLogger = console): void;
  pause(): void;
  resume(): void;
  skip(): void;
  step(): void;
  teardown(): void;
}
```

Calling `step` will release a single paused notification. The other methods to what their names suggest. Calling `resume` will play all buffered notifications before resuming.

<a name="module-let"></a>

### let

```ts
interface Spy {
  let(
    match: string | RegExp | MatchPredicate | Observable<any>,
    select: (source: Observable<any>) => Observable<any>,
    options?: Options
  ): Teardown;
}
```

Wires up an instance of the let plugin for matching observables.

This is equivalent to the `let` operator. All subscriptions to matching observables will instead be made to the observable returned by the specified `select` function.

If `complete` option is `false`, completion notifications received from the selected observable will not be forwarded to subscribers.

This method returns a teardown function.

<a name="module-debug"></a>

### debug

```ts
interface Spy {
  debug(
    match: string | RegExp | MatchPredicate | Observable<any>,
    ...notifications: ("complete" | "error" | "next" | "subscribe" | "unsubscribe")[]
  ): Teardown;
}
```

Wires up an instance of the debug plugin for matching observables.

Whenever one of the specified notifications occurs, a `debugger` statement in the plugin will pause execution. If no notifications are specified in the call, execution will be paused when any of the notifications occurs.

This method returns a teardown function.

<a name="module-flush"></a>

### flush

```ts
interface Spy {
  flush(): void;
}
```

Calling `flush` will see `flush` called on each plugin.

If snapshotting is enabled, calling `flush` will release excess values and completed or errored obervables from within snapshots.

<a name="module-plug"></a>

### plug

```ts
interface Spy {
  plug(...plugins: Plugin[]): Teardown;
}
```

Wires up the specified plugin(s) and returns a teardown function.

<a name="module-unplug"></a>

### unplug

```ts
interface Spy {
  unplug(...plugins: Plugin[]): void;
}
```

Removes the specified plugin(s).

<a name="module-find"></a>

### find

```ts
interface Spy {
  find<T extends Plugin>(constructor: { new (...args: any[]): T }): T | undefined;
}
```

Returns the first plugin matching the specified constructor/class.

<a name="module-findAll"></a>

### findAll

```ts
interface Spy {
  findAll<T extends Plugin>(constructor: { new (...args: any[]): T }): T[];
  findAll(): T[];
}
```

Returns all plugins matching the specified constructor/class. Or all plugins of no constructor is specified.

<a name="module-stats"></a>

### stats

```ts
interface Spy {
  stats(partialLogger: PartialLogger = console): void;
}
```

Writes, to the console, counts of the number of notifications, etc.

<a name="module-teardown"></a>

### teardown

```ts
interface Spy {
  teardown(): void;
}
```

Tears down the spy.

<a name="module-detect"></a>

### detect

```ts
function detect(id: string): void;
```

Writes, to the console, any subscriptions and unsubscriptions that have occurred since the previous `detect` call with the specified `id`.

The `detect` method is implemented so that it can be imported and called regardless of whether or not the spy is configured. That is, calls can be left in production code, as they become no-ops. It should be imported like this:

```ts
import { detect } from "rxjs-spy/detect";
```

## Console API

The methods in the console API are callable via the `rxSpy` global (note the lower-case `r`) and are intended to be used interactively in the browser's console.

They are identical to the methods in the spy instances created using the module API except for the fact that they do not return teardown functions. Instead, calls can be undone using the `undo` API method.

* [`rxSpy.undo`](#console-undo)
* [`rxSpy.deck`](#console-deck)

<a name="console-undo"></a>

### undo

```ts
function undo(...calls: number[]): void
```

When called without arguments, the `undo` method will display in the console a list of the `rxjs-spy` calls that can be undone.

Calls are listed against a call number and one or more of those numbers can be passed to `undo` to undo specific calls.

Undoing a `spy` call will undo all calls.

<a name="console-deck"></a>

### deck

```ts
function deck(call?: number): Deck | undefined
```

In the console, it's easy to forget to use a variable to capture the `Deck` returned by a call to `pause`. In those situations, you can call the `deck` method without an argument to see a list of numbered `pause` calls. Calling `deck` again, passing a call number, will return the `Deck` associated with the specified `pause` call.