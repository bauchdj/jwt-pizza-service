import { NextFunction, Request, Response } from "express";
import { MetricBatcher } from "../utils/metricBatcher";
import metrics from "./metric";

interface RequestMetric {
	method: string;
	value: number;
}

// Create a batcher for request metrics
const requestBatcher = new MetricBatcher<RequestMetric>(
	async (items: RequestMetric[]) => {
		// Group and sum by HTTP method
		const methodCounts = items.reduce((acc, item) => {
			acc[item.method] = (acc[item.method] || 0) + item.value;

			return acc;
		}, {} as Record<string, number>);

		// Build metrics for each HTTP method
		const methodMetrics = Object.entries(methodCounts).map(
			([method, count]) =>
				metrics.buildSumMetric({
					name: "http_requests",
					value: count,
					tags: { method },
				})
		);

		await metrics.sendMetrics(methodMetrics);
	},
	60000 // Send every minute
);

// Middleware to track HTTP methods
export function requestMetricsMiddleware(
	req: Request,
	res: Response,
	next: NextFunction
) {
	requestBatcher.push({
		method: req.method,
		value: 1,
	});

	next();
}
