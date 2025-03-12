import os from "os";
import { MetricBatcher } from "../utils/metricBatcher";
import metrics from "./metric";
import { metricConfig } from "./metricConfig";

interface SystemMetric {
	value: number;
	type: "cpu" | "memory";
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
	private readonly batcher: MetricBatcher<SystemMetric>;

	constructor() {
		this.batcher = new MetricBatcher<SystemMetric>(
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

				await metrics.sendMetrics(gaugeMetrics);
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

			this.batcher.push({
				value: cpuUsage,
				type: "cpu",
			});

			this.batcher.push({
				value: memoryUsage,
				type: "memory",
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
