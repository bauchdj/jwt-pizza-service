import { NextFunction, Request, Response } from "express";
import { MetricBatcher } from "../utils/metricBatcher";
import { metricConfig } from "./metricConfig";
import metrics from "./metrics";

interface RequestMetric {
	method: string;
	value: number;
}

// Create a batcher for request metrics
const requestBatcher = new MetricBatcher<RequestMetric>(
	async (items: RequestMetric[]) => {
		// TODO: default to value: 0 for each metric
		// Group by method and sum values
		const methodCounts = items.reduce((acc, item) => {
			acc[item.method] = (acc[item.method] || 0) + item.value;

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

		await metrics.sendMetrics(methodMetrics);
	},
	{ intervalMs: metricConfig.batchIntervalMs }
);

// Middleware to track HTTP methods
export function requestMetricsMiddleware(
	req: Request,
	res: Response,
	next: NextFunction
) {
	requestBatcher.push({ method: req.method, value: 1 });
	next();
}
