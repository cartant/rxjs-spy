# rxjs-spy

[![NPM version](https://img.shields.io/npm/v/rxjs-spy.svg)](https://www.npmjs.com/package/rxjs-spy)
[![Build status](https://img.shields.io/travis/cartant/rxjs-spy.svg)](http://travis-ci.org/cartant/rxjs-spy)
[![dependency status](https://img.shields.io/david/cartant/rxjs-spy.svg)](https://david-dm.org/cartant/rxjs-spy)
[![devDependency Status](https://img.shields.io/david/dev/cartant/rxjs-spy.svg)](https://david-dm.org/cartant/rxjs-spy#info=devDependencies)
[![peerDependency Status](https://img.shields.io/david/peer/cartant/rxjs-spy.svg)](https://david-dm.org/cartant/rxjs-spy#info=peerDependencies)

### What is it?

`rxjs-spy` is a debugging library for RxJS.

### Why might I need it?

The compositional and sometimes-asynchronous nature of RxJS can make debugging something of a challenge. Often, the go-to debugging approach is to sprinkle `do` operators and logging throughout the codebase.

`rxjs-spy` seeks to address this by implementing a unobtrusive mechanism for identifying observables and by providing an API for logging and inspecting observable subscriptions.

## Install

Install the package using NPM:

```
npm install rxjs-spy --save
```

And import the functions for use with TypeScript and ES2015:

```js
import { spy } from "rxjs-spy";
const unspy = spy();
```

Or `require` the module for use with Node or a CommonJS bundler:

```js
const rxjsSpy = require("rxjs-spy");
const unspy = rxjsSpy.spy();
```

Or include the UMD bundle for use as a `script`:

```html
<script src="https://unpkg.com/rxjs/bundles/Rx.min.js"></script>
<script src="https://unpkg.com/rxjs-spy"></script>
<script>
var unspy = RxSpy.spy();
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

The API's methods are tag-based and tags can be matched using explicit literals, regular expressions or function predicates. For example, logging for the above tag could be enabled like this:

```js
import { log } from "rxjs-spy";
log("some-tag");
```

`rxjs-spy` exposes a module API intended to be called from code and a console API - via the `rxSpy` global - intended for interactive use via the browser's console.

## Module API

The methods in the module API are callable via imports, requires or the UMD `RxSpy` global. Most methods return a teardown function that will undo the API method's action when called.

* [spy](#module-spy)
* [show](#module-show)
* [log](#module-log)
* [debug](#module-debug)
* [patch](#module-patch)

<a name="module-spy"></a>

### spy

```ts
function spy({ plugins }: { plugins?: Plugin[] } = {}): () => void
```

Calling `spy` attaches the spy to `Observable.prototype.subscribe`.

By default, `spy` will wire up the snapshotting plugin. However, if the `plugins` option is specified, only the plugins it contains will be wired up - so, to disable snapshotting, specify an empty array.

This method returns a teardown function.

<a name="module-show"></a>

### show

```ts
function show(
  partialLogger?: PartialLogger = console
): void

function show(
  match?: string | RegExp | MatchPredicate | Observable<any>,
  partialLogger?: PartialLogger = console
): void
```

Calling `show` will log information regarding the matching observables to the console or to the specified logger. If no `match` is specified, all tagged observables will be logged.

The logged information is retrieved from the most recent snapshot, so if snapshotting is not enabled, an error will be thrown.

<a name="module-log"></a>

### log

```ts
function log(
  match: string | RegExp | MatchPredicate | Observable<any>,
  partialLogger: PartialLogger = console
): () => void
```

Wires up an instance of the log plugin for matching observables.

All `subscribe`, `next`, `complete`, `error` and `unsubscribe` events will be logged to the console or to the specified logger.

This method returns a teardown function.

<a name="module-debug"></a>

### debug

```ts
function debug(
  match: string | RegExp | MatchPredicate | Observable<any>,
  ...events: ("complete" | "error" | "next" | "subscribe" | "unsubscribe")[]
): () => void
```

Wires up an instance of the debug plugin for matching observables.

Whenever one of the specified events occurs, a `debugger` statement in the plugin will pause execution. If no events are specified in the call, execution will be paused when any of the events occurs.

Immediately above the `debugger` statement, there is a snapshot variable - so if snapshotting is enabled, a snapshot will be available for inspection within the debugger.

This method returns a teardown function.

<a name="module-patch"></a>

### patch

```ts
function patch(
  match: string | RegExp | MatchPredicate | Observable<any>,
  source: Observable<any>
): () => void

function patch(
  match: string | RegExp | MatchPredicate | Observable<any>,
  project: (value: any) => any
): () => void

function patch(
  match: string | RegExp | MatchPredicate | Observable<any>,
  value: any
): () => void
```

Wires up an instance of the patch plugin for matching observables.

If a `source` observable is specified, subscribers to matching observables will be subscribed to the specified observable instead.

If either a `project` function or a `value` is specified, each value emitted by matching observables will be replaced with the projected or specified value.

This method returns a teardown function.

## Console API

The methods in the console API are callable via the `rxSpy` global (note the lower-case `r`) and are intended to be used interactively in the browser's console.

They are identical to the methods in the module API except for the fact that they do not return teardown functions. Instead, calls can be undone using the `undo` API method.

### undo

```ts
function undo(...calls: number[]): void
```

When called without arguments, the `undo` method will display in the console a list of the `rxjs-spy` calls that can be undone.

Calls are listed against a call number and one or more of those numbers can be passed to `undo` to undo specific calls.

Undoing a `spy` call will undo all calls.