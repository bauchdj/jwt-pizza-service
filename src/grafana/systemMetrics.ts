import os from "os";
import { MetricBatcher } from "../utils/metricBatcher";
import metrics from "./metric";

interface SystemMetric {
	name: string;
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
						name: `system_${item.type}_usage`,
						value: item.value,
						tags: { unit: "percentage" },
					})
				);

				await metrics.sendMetrics(gaugeMetrics);
			},
			60000 // Send every minute
		);
	}

	start(): void {
		if (this.collectionInterval) {
			return; // Already started
		}

		// Collect metrics every 10 seconds
		this.collectionInterval = setInterval(() => {
			const cpuUsage = getCPUUsage();
			const memoryUsage = getMemoryUsage();

			this.batcher.push({
				name: "cpu_usage",
				value: cpuUsage,
				type: "cpu",
			});

			this.batcher.push({
				name: "memory_usage",
				value: memoryUsage,
				type: "memory",
			});
		}, 10000); // Collect every 10 seconds
	}

	stop(): void {
		if (this.collectionInterval) {
			clearInterval(this.collectionInterval);
			this.collectionInterval = null;
		}
	}
}

// Export a singleton instance
const systemMetrics = new SystemMetricsCollector();

export const startSystemMetricsCollection = () => systemMetrics.start();
