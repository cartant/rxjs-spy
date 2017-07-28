<a name="3.0.0"></a>
## [3.0.0](https://github.com/cartant/rxjs-spy/compare/v2.1.0...v3.0.0) (2017-07-27)

### Breaking Changes

No breaking changes to the module or console APIs, but the plugin interface and the snapshots have changed - the changes account for subscribers being able to have multiple subscriptions.

* **Snapshots**: Include subscription on stack. ([6a270e4](https://github.com/cartant/rxjs-spy/commit/6a270e4))
* **Snapshots**: Rename snapshots. ([f3d1992](https://github.com/cartant/rxjs-spy/commit/f3d1992))
* **Plugin**: Add SubscriptionRef. ([953260d](https://github.com/cartant/rxjs-spy/commit/953260d))
* **Snapshots**: Separate records/snapshots. ([fd04a76](https://github.com/cartant/rxjs-spy/commit/fd04a76))

<a name="2.1.0"></a>
## [2.1.0](https://github.com/cartant/rxjs-spy/compare/v2.0.0...v2.1.0) (2017-07-24)

### Features

* **Stack traces:** Include `subscribe` stack traces in `log` and `show` output. ([d7abd57](https://github.com/cartant/rxjs-spy/commit/d7abd57) and [ec926ad](https://github.com/cartant/rxjs-spy/commit/ec926ad))

<a name="2.0.0"></a>
## [2.0.0](https://github.com/cartant/rxjs-spy/compare/v1.0.1...v2.0.0) (2017-07-19)

### Breaking Changes

* **Snapshots:** Remove values from observable snapshots; only store values against subscriptions. ([48f7483](https://github.com/cartant/rxjs-spy/commit/48f7483))
* **Plugin events:** Rename plugin events to notifications. ([6018d38](https://github.com/cartant/rxjs-spy/commit/6018d38))