import { NextFunction, Request, Response } from "express";
import { MetricBatcher } from "../utils/metricBatcher";
import { metricConfig } from "./metricConfig";
import metrics, { GaugeMetric } from "./metrics";

interface LatencyMetric {
	route: string;
	method: string;
	latencyMs: number;
	endpointId?: string;
}

interface LatencyStats {
	route: string;
	method: string;
	endpointId?: string;
	count: number;
	totalLatency: number;
	maxLatency: number;
	minLatency: number;
}

class LatencyMetricsProcessor {
	private static calculateLatencyMs(start: [number, number]): number {
		const [seconds, nanoseconds] = process.hrtime(start);

		return Math.round((seconds * 1000 + nanoseconds / 1e6) * 100) / 100;
	}

	private static getRouteFromRequest(req: Request): string {
		return req.route ? req.route.path : req.path;
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
			endpointId,
		};
	}

	private static aggregateLatencyStats(
		items: LatencyMetric[]
	): Record<string, LatencyStats> {
		return items.reduce((acc, item) => {
			const key = `${item.method}:${item.route}${
				item.endpointId ? `:${item.endpointId}` : ""
			}`;

			if (!acc[key]) {
				acc[key] = {
					route: item.route,
					method: item.method,
					endpointId: item.endpointId,
					count: 0,
					totalLatency: 0,
					maxLatency: -Infinity,
					minLatency: Infinity,
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
			...(stats.endpointId && { endpoint_id: stats.endpointId }),
		};

		return [
			metrics.buildGaugeMetric({
				name: "request_latency",
				value: avgLatency,
				unit: "ms",
				tags: { ...tags, type: "avg" },
				useDouble: true,
			}),
			metrics.buildGaugeMetric({
				name: "request_latency",
				value: stats.maxLatency,
				unit: "ms",
				tags: { ...tags, type: "max" },
				useDouble: true,
			}),
			metrics.buildGaugeMetric({
				name: "request_latency",
				value: stats.minLatency,
				unit: "ms",
				tags: { ...tags, type: "min" },
				useDouble: true,
			}),
		];
	}

	static async processLatencyMetrics(items: LatencyMetric[]) {
		const stats = this.aggregateLatencyStats(items);

		const latencyMetrics = Object.values(stats).flatMap(
			this.buildMetricsFromStats
		);

		return latencyMetrics;
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

const latencyBatcher = new MetricBatcher<LatencyMetric, GaugeMetric>(
	LatencyMetricsProcessor.processLatencyMetrics.bind(LatencyMetricsProcessor),
	{ intervalMs: metricConfig.batchIntervalMs }
);

// General latency middleware
export const latencyMetricsMiddleware =
	LatencyMetricsProcessor.createLatencyMiddleware();

// Create endpoint-specific latency middleware
export const createEndpointLatencyMiddleware = (endpointId: string) =>
	LatencyMetricsProcessor.createLatencyMiddleware(endpointId);
