type MetricSender<T> = (items: T[]) => Promise<void>;

// Keep track of active batchers by type
class BatcherRegistry {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private static batchers: MetricBatcher<any>[] = [];

	static register<T>(batcher: MetricBatcher<T>): void {
		this.batchers.push(batcher);
	}

	static unregister<T>(batcher: MetricBatcher<T>): void {
		const index = this.batchers.indexOf(batcher);

		if (index > -1) {
			this.batchers.splice(index, 1);
		}
	}

	static stopAll(): void {
		this.batchers.forEach((batcher) => batcher.stop());
		this.batchers = [];
	}
}

export class MetricBatcher<T> {
	private queue: T[] = [];
	private interval: NodeJS.Timeout;
	private readonly sender: MetricSender<T>;

	constructor(
		sender: MetricSender<T>,
		intervalMs: number = 60000 // Default to 1 minute
	) {
		this.sender = sender;
		this.interval = setInterval(() => this.flush(), intervalMs);
		BatcherRegistry.register(this);
	}

	push(item: T): void {
		this.queue.push(item);
	}

	async flush(): Promise<void> {
		await this.sender(this.queue);
		this.queue = [];
	}

	stop(): void {
		clearInterval(this.interval);
		BatcherRegistry.unregister(this);
	}
}

// Set up process handlers to clean up all batchers
process.on("SIGTERM", () => {
	BatcherRegistry.stopAll();
});

process.on("SIGINT", () => {
	BatcherRegistry.stopAll();
});
