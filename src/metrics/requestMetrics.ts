import { NextFunction, Request, Response } from "express";
import { MetricBatcher, type MetricBatcherQueueItem } from "./metricBatcher";
import { metricConfig } from "./metricConfig";
import metrics, { SumMetric } from "./metrics";

interface RequestMetric extends MetricBatcherQueueItem {
	method: string;
}

// Create a batcher for request metrics
const requestBatcher = new MetricBatcher<RequestMetric, SumMetric>(
	async (items: RequestMetric[]) => {
		// Group by method and sum values
		const methodCounts = items.reduce((acc, item) => {
			const prevTotal = acc[item.method] || 0;
			const total = prevTotal + item.value;

			acc[item.method] = total;

			return acc;
		}, {} as Record<string, number>);

		// Build sum metrics for each HTTP method
		const methodMetrics = Object.entries(methodCounts).map(
			([method, count]) =>
				metrics.buildSumMetric({
					name: "http_requests",
					value: count,
					unit: "count",
					tags: { method },
					useDouble: false, // Use integer for request counts
				})
		);

		return methodMetrics;
	},
	{ intervalMs: metricConfig.batchIntervalMs }
);

// Middleware to track HTTP methods
export function requestMetricsMiddleware(
	req: Request,
	res: Response,
	next: NextFunction
) {
	requestBatcher.push({ id: req.method, method: req.method, value: 1 });
	next();
}
