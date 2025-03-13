import os from "os";
import { MetricBatcher, type MetricBatcherQueueItem } from "./metricBatcher";
import { metricConfig } from "./metricConfig";
import metrics, { GaugeMetric } from "./metrics";

type SystemMetricType = "cpu" | "memory";

interface SystemMetric extends MetricBatcherQueueItem {
	type: SystemMetricType;
}

function getCPUUsage(): number {
	const cpus = os.cpus();

	const totalUsage = cpus.reduce((acc, cpu) => {
		const total = Object.values(cpu.times).reduce(
			(sum, time) => sum + time,
			0
		);

		const idle = cpu.times.idle;

		return acc + ((total - idle) / total) * 100;
	}, 0);

	return Math.round((totalUsage / cpus.length) * 100) / 100; // Average CPU usage as percentage
}

function getMemoryUsage(): number {
	const totalMemory = os.totalmem();
	const freeMemory = os.freemem();
	const usedMemory = totalMemory - freeMemory;

	return Math.round((usedMemory / totalMemory) * 10000) / 100; // Memory usage as percentage
}

class SystemMetricsCollector {
	private collectionInterval: NodeJS.Timeout | null = null;
	private readonly batcher: MetricBatcher<SystemMetric, GaugeMetric>;

	constructor() {
		this.batcher = new MetricBatcher<SystemMetric, GaugeMetric>(
			async (items: SystemMetric[]) => {
				// Group metrics by type and get latest values
				const latestMetrics = items.reduce((acc, item) => {
					if (!acc[item.type] || acc[item.type].value < item.value) {
						acc[item.type] = item;
					}

					return acc;
				}, {} as Record<string, SystemMetric>);

				// Build gauge metrics for each system metric
				const gaugeMetrics = Object.values(latestMetrics).map((item) =>
					metrics.buildGaugeMetric({
						name: "system_usage",
						value: item.value,
						unit: "percent",
						tags: { type: item.type },
						useDouble: true, // Use double for decimal percentages
					})
				);

				return gaugeMetrics;
			},
			{ intervalMs: metricConfig.batchIntervalMs }
		);
	}

	start(): void {
		if (this.collectionInterval) {
			return; // Already started
		}

		// Collect metrics using configured interval
		this.collectionInterval = setInterval(() => {
			const cpuUsage = getCPUUsage();
			const memoryUsage = getMemoryUsage();

			let type: SystemMetricType = "cpu";

			this.batcher.push({
				id: type,
				value: cpuUsage,
				type,
			});

			type = "memory";

			this.batcher.push({
				id: type,
				value: memoryUsage,
				type,
			});
		}, metricConfig.collectionIntervalMs);
	}

	stop(): void {
		if (this.collectionInterval) {
			clearInterval(this.collectionInterval);
			this.collectionInterval = null;
		}

		this.batcher.stop();
	}
}

// Export a singleton instance
const systemMetrics = new SystemMetricsCollector();

export default systemMetrics;
