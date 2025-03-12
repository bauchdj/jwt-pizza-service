import { NextFunction, Request, Response } from "express";
import { MetricBatcher } from "../utils/metricBatcher";
import metrics from "./metric";

interface LatencyMetric {
	route: string;
	method: string;
	latencyMs: number;
	endpointId?: string;
}

interface LatencyStats {
	count: number;
	totalLatency: number;
	maxLatency: number;
	minLatency: number;
	method: string;
	route: string;
	endpointId?: string;
}

class LatencyMetricsProcessor {
	private static calculateLatencyMs(start: [number, number]): number {
		const [seconds, nanoseconds] = process.hrtime(start);

		return Math.round((seconds * 1000 + nanoseconds / 1e6) * 100) / 100;
	}

	private static getRouteFromRequest(req: Request): string {
		return req.route?.path || req.path || "unknown";
	}

	private static createLatencyMetric(
		route: string,
		method: string,
		latencyMs: number,
		endpointId?: string
	): LatencyMetric {
		return {
			route,
			method,
			latencyMs,
			...(endpointId && { endpointId }),
		};
	}

	private static aggregateLatencyStats(items: LatencyMetric[]): Record<string, LatencyStats> {
		return items.reduce((acc, item) => {
			const key = item.endpointId || `${item.method}:${item.route}`;

			if (!acc[key]) {
				acc[key] = {
					count: 0,
					totalLatency: 0,
					maxLatency: 0,
					minLatency: Infinity,
					method: item.method,
					route: item.route,
					endpointId: item.endpointId,
				};
			}

			const stats = acc[key];

			stats.count++;
			stats.totalLatency += item.latencyMs;
			stats.maxLatency = Math.max(stats.maxLatency, item.latencyMs);
			stats.minLatency = Math.min(stats.minLatency, item.latencyMs);

			return acc;
		}, {} as Record<string, LatencyStats>);
	}

	private static buildMetricsFromStats(stats: LatencyStats) {
		const avgLatency = Math.round(stats.totalLatency / stats.count);

		const tags = {
			method: stats.method,
			route: stats.route,
			unit: "ms",
			...(stats.endpointId && { endpoint: stats.endpointId }),
		};

		return [
			metrics.buildGaugeMetric({
				name: "request_latency_avg",
				value: avgLatency,
				tags,
			}),
			metrics.buildGaugeMetric({
				name: "request_latency_max",
				value: stats.maxLatency,
				tags,
			}),
			metrics.buildGaugeMetric({
				name: "request_latency_min",
				value: stats.minLatency,
				tags,
			}),
		];
	}

	static async processLatencyMetrics(items: LatencyMetric[]) {
		const stats = this.aggregateLatencyStats(items);
		const latencyMetrics = Object.values(stats).flatMap(this.buildMetricsFromStats);

		await metrics.sendMetrics(latencyMetrics);
	}

	static createLatencyMiddleware(endpointId?: string) {
		return (req: Request, res: Response, next: NextFunction) => {
			const start = process.hrtime();

			res.on("finish", () => {
				const latencyMs = this.calculateLatencyMs(start);
				const route = this.getRouteFromRequest(req);

				const metric = this.createLatencyMetric(
					route,
					req.method,
					latencyMs,
					endpointId
				);

				latencyBatcher.push(metric);
			});

			next();
		};
	}
}

const latencyBatcher = new MetricBatcher<LatencyMetric>(
	LatencyMetricsProcessor.processLatencyMetrics.bind(LatencyMetricsProcessor),
	60000 // Send every minute
);

// General latency middleware
export const latencyMetricsMiddleware = LatencyMetricsProcessor.createLatencyMiddleware();

// Create endpoint-specific latency middleware
export const createEndpointLatencyMiddleware = (endpointId: string) =>
	LatencyMetricsProcessor.createLatencyMiddleware(endpointId);
