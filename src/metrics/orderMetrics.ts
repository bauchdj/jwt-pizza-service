import { MetricBatcher, type MetricBatcherQueueItem } from "./metricBatcher";
import { metricConfig } from "./metricConfig";
import metrics, { GaugeMetric, SumMetric } from "./metrics";

interface OrderMetric extends MetricBatcherQueueItem {
	type: "sold" | "failed" | "revenue";
}

const orderBatcher = new MetricBatcher<OrderMetric, SumMetric | GaugeMetric>(
	async (items: OrderMetric[]) => {
		// Group metrics by type and sum values
		const typeSums = items.reduce((acc, item) => {
			const prevTotal = acc[item.type] || 0;
			const total = prevTotal + item.value;

			acc[item.type] = total;

			return acc;
		}, {} as Record<string, number>);

		// Build metrics for each type
		const orderMetrics = Object.entries(typeSums).map(([type, value]) => {
			const name = "order";

			if (type === "revenue") {
				return metrics.buildGaugeMetric({
					name,
					value,
					unit: "bitcoin",
					tags: { type },
					useDouble: true, // Use double for currency values
				});
			}

			return metrics.buildSumMetric({
				name,
				value,
				unit: "count",
				tags: { type },
				useDouble: false, // Use integer for counts
			});
		});

		return orderMetrics;
	},
	{ intervalMs: metricConfig.batchIntervalMs }
);

export function pushOrderSold() {
	const type = "sold";

	orderBatcher.push({ id: type, type, value: 1 });
}

export function pushOrderFailed() {
	const type = "failed";

	orderBatcher.push({ id: type, type, value: 1 });
}

export function pushOrderRevenue(amount: number) {
	const type = "revenue";

	orderBatcher.push({ id: type, type, value: amount });
}
