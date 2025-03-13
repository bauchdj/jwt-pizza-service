import metrics, { type Metric } from "../metrics/metrics";

type MetricSender<T, U extends Metric> = (items: T[]) => Promise<U[]>;

// Keep track of active batchers by type
class BatcherRegistry {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private static batchers: MetricBatcher<any, any>[] = [];

	static register<T, U extends Metric>(batcher: MetricBatcher<T, U>): void {
		this.batchers.push(batcher);
	}

	static unregister<T, U extends Metric>(batcher: MetricBatcher<T, U>): void {
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

interface MetricBatcherConfig {
	intervalMs?: number;
}

export class MetricBatcher<T, U extends Metric> {
	private queue: T[] = [];
	private interval: NodeJS.Timeout;
	private readonly getBatchOfMetrics: MetricSender<T, U>;

	constructor(
		getBatchOfMetrics: MetricSender<T, U>,
		config?: MetricBatcherConfig
	) {
		const intervalMs = config?.intervalMs ?? 60000; // Default to 1 minute if not specified

		this.getBatchOfMetrics = getBatchOfMetrics;
		this.interval = setInterval(() => this.flush(), intervalMs);
		BatcherRegistry.register(this);
	}

	push(item: T): void {
		this.queue.push(item);
	}

	async flush(): Promise<void> {
		if (this.queue.length === 0) {
			return;
		}

		console.dir(this.queue, { depth: null });

		const batchOfMetrics = await this.getBatchOfMetrics(this.queue);

		await metrics.sendMetrics(batchOfMetrics);

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
