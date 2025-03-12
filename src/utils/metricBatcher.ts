type MetricSender<T> = (items: T[]) => Promise<void>;

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
	}
}
