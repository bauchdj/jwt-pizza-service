import config from "../config";

interface MetricAttribute {
	key: string;
	value: {
		stringValue: string;
	};
}

interface DataPoint {
	asInt: number;
	timeUnixNano: string;
	attributes: MetricAttribute[];
}

interface SumMetric extends Metric {
	sum: {
		dataPoints: DataPoint[];
		aggregationTemporality: string;
		isMonotonic: boolean;
	};
}

interface GaugeMetric extends Metric {
	gauge: {
		dataPoints: DataPoint[];
	};
}

interface ResourceMetrics<T extends Metric> {
	resourceMetrics: Array<{
		scopeMetrics: Array<{
			metrics: T[];
		}>;
	}>;
}

interface Metric {
	name: string;
	unit?: string;
	tags?: Record<string, string>;
}

interface MetadataToBuildMetric {
	name: string;
	value: number;
	tags?: Record<string, string>;
}

class MetricsClient {
	private readonly endpoint: string;
	private readonly source: string;
	private readonly apiKey: string;

	constructor(
		endpoint: string = config.grafana.url,
		source: string = config.grafana.source,
		apiKey: string = config.grafana.apiKey
	) {
		this.endpoint = endpoint;
		this.source = source;
		this.apiKey = apiKey;
	}

	private getCurrentTimeNano(): string {
		return (Date.now() * 1_000_000).toString();
	}

	private createAttributes(tags?: Record<string, string>): MetricAttribute[] {
		const baseAttributes: MetricAttribute[] = [
			{
				key: "source",
				value: { stringValue: this.source },
			},
		];

		if (tags) {
			return [
				...baseAttributes,
				...Object.entries(tags).map(([key, value]) => ({
					key,
					value: { stringValue: value },
				})),
			];
		}

		return baseAttributes;
	}

	createResourceMetrics<T extends Metric>(metrics: T[]): ResourceMetrics<T> {
		return {
			resourceMetrics: [
				{
					scopeMetrics: [{ metrics }],
				},
			],
		};
	}

	buildSumMetric({ name, value, tags }: MetadataToBuildMetric): SumMetric {
		const timeUnixNano = this.getCurrentTimeNano();
		const attributes = this.createAttributes(tags);

		const sumMetric: SumMetric = {
			name,
			unit: "count",
			sum: {
				dataPoints: [
					{
						asInt: value,
						timeUnixNano,
						attributes,
					},
				],
				aggregationTemporality: "AGGREGATION_TEMPORALITY_CUMULATIVE",
				isMonotonic: true,
			},
		};

		return sumMetric;
	}

	buildGaugeMetric({
		name,
		value,
		tags,
	}: MetadataToBuildMetric): GaugeMetric {
		const timeUnixNano = this.getCurrentTimeNano();
		const attributes = this.createAttributes(tags);

		const gaugeMetric: GaugeMetric = {
			name,
			unit: "%",
			gauge: {
				dataPoints: [
					{
						asInt: value,
						timeUnixNano,
						attributes,
					},
				],
			},
		};

		return gaugeMetric;
	}

	async sendSumMetric({
		name,
		value,
		tags,
	}: MetadataToBuildMetric): Promise<void> {
		const sumMetric: SumMetric = this.buildSumMetric({
			name,
			value,
			tags,
		});

		try {
			await this.sendMetrics<SumMetric>([sumMetric]);
		} catch (error) {
			console.error("Error sending sum metric:", error);
			throw error;
		}
	}

	async sendGaugeMetric({
		name,
		value,
		tags,
	}: MetadataToBuildMetric): Promise<void> {
		const gaugeMetric: GaugeMetric = this.buildGaugeMetric({
			name,
			value,
			tags,
		});

		try {
			await this.sendMetrics([gaugeMetric]);
		} catch (error) {
			console.error("Error sending gauge metric:", error);
			throw error;
		}
	}

	async sendMetrics<T extends Metric>(metrics: T[]): Promise<void> {
		const resourceMetrics: ResourceMetrics<T> =
			this.createResourceMetrics(metrics);

		try {
			await this.postMetrics<T>(resourceMetrics);
		} catch (error) {
			console.error("Error sending metrics:", error);
			throw error;
		}
	}

	private async postMetrics<T extends Metric>(
		resourceMetrics: ResourceMetrics<T>
	): Promise<void> {
		console.dir(resourceMetrics, { depth: null });

		try {
			const response = await fetch(this.endpoint, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${this.apiKey}`,
				},
				body: JSON.stringify(resourceMetrics),
			});

			if (!response.ok) {
				throw new Error(
					`Failed to send metrics: ${response.statusText}`
				);
			}
		} catch (error) {
			console.error("Error sending metrics:", error);
			throw error;
		}
	}
}

// Export a singleton instance
const metrics = new MetricsClient();

export default metrics;
