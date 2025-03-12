import { MetricBatcher } from "../utils/metricBatcher";
import metrics from "./metric";

interface OrderMetric {
	type: "sold" | "failed" | "revenue";
	value: number;
}

const orderBatcher = new MetricBatcher<OrderMetric>(
	async (items: OrderMetric[]) => {
		// Group metrics by type and sum values
		const typeSums = items.reduce((acc, item) => {
			acc[item.type] = (acc[item.type] || 0) + item.value;

			return acc;
		}, {} as Record<string, number>);

		// Build metrics for each type
		const orderMetrics = Object.entries(typeSums).map(([type, value]) => {
			if (type === "revenue") {
				return metrics.buildGaugeMetric({
					name: "order_revenue",
					value,
					tags: { unit: "usd" },
				});
			}

			return metrics.buildSumMetric({
				name: `order_${type}`,
				value,
				tags: { status: type },
			});
		});

		await metrics.sendMetrics(orderMetrics);
	},
	60000 // Send every minute
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
