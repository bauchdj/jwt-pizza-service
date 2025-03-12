import { MetricBatcher } from "../utils/metricBatcher";
import { metricConfig } from "./metricConfig";
import metrics from "./metrics";

interface OrderMetric {
	type: "sold" | "failed" | "revenue";
	value: number;
}

const orderBatcher = new MetricBatcher<OrderMetric>(
	async (items: OrderMetric[]) => {
		// TODO: default to value: 0 for each metric
		// Group metrics by type and sum values
		const typeSums = items.reduce((acc, item) => {
			acc[item.type] = (acc[item.type] || 0) + item.value;

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

		await metrics.sendMetrics(orderMetrics);
	},
	{ intervalMs: metricConfig.batchIntervalMs }
);

export function pushOrderSold() {
	orderBatcher.push({ type: "sold", value: 1 });
}

export function pushOrderFailed() {
	orderBatcher.push({ type: "failed", value: 1 });
}

export function pushOrderRevenue(amount: number) {
	orderBatcher.push({ type: "revenue", value: amount });
}
