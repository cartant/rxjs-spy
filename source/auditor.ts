/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

export interface Task {
    (ignored: number): void;
}

export class Auditor {

    private queue_: {
        ignored: number;
        source: any;
        task: Task;
        timestamp: number;
    }[] = [];
    private timeoutId_: any;

    constructor(public readonly duration: number) {}

    audit(source: any, task: Task): void {

        const { duration, queue_ } = this;

        if (duration <= 0) {
            task(0);
        } else {
            const queued = {
                ignored: 0,
                source,
                task,
                timestamp: Date.now()
            };
            const index = queue_.findIndex(q => q.source === source);
            if (index !== -1) {
                const { ignored, timestamp } = queue_[index];
                queued.ignored += ignored + 1;
                queued.timestamp = timestamp;
                queue_.splice(index, 1);
            }
            queue_.push(queued);
            this.wait_();
        }
    }

    private wait_(): void {

        const { duration, queue_ } = this;

        if ((this.timeoutId_ === undefined) && (queue_.length > 0)) {
            const queued = queue_[0];
            this.timeoutId_ = setTimeout(() => {

                const before = Date.now() - duration;
                while ((queue_.length > 0) && (queue_[0].timestamp <= before)) {
                    const dequeued = queue_.shift()!;
                    dequeued.task(dequeued.ignored);
                }
                this.timeoutId_ = undefined;
                this.wait_();

            },  Math.max(0, queued.timestamp + duration - Date.now()));
        }
    }
}
