import config from "../config";

interface MetricAttribute {
	key: string;
	value: {
		stringValue: string;
	};
}

interface DataPoint {
	asInt?: number;
	asDouble?: number;
	timeUnixNano: string;
	attributes: MetricAttribute[];
}

export interface SumMetric extends Metric {
	sum: {
		dataPoints: DataPoint[];
		aggregationTemporality: string;
		isMonotonic: boolean;
	};
}

export interface GaugeMetric extends Metric {
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

export interface Metric {
	name: string;
	unit?: string;
	tags?: Record<string, string>;
}

export interface MetadataToBuildMetric extends MetadataBase {
	name: string;
	unit: string;
	tags?: Record<string, string>;
	useDouble?: boolean;
}

export interface MetadataBase {
	value: number;
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
		return (Date.now() * 1e6).toString();
	}

	private createAttributes(tags?: Record<string, string>): MetricAttribute[] {
		const attributes: MetricAttribute[] = [
			{
				key: "source",
				value: {
					stringValue: this.source,
				},
			},
		];

		if (tags) {
			Object.entries(tags).forEach(([key, value]) => {
				attributes.push({
					key,
					value: {
						stringValue: value,
					},
				});
			});
		}

		return attributes;
	}

	private createResourceMetrics<T extends Metric>(
		metrics: T[]
	): ResourceMetrics<T> {
		return {
			resourceMetrics: [
				{
					scopeMetrics: [
						{
							metrics,
						},
					],
				},
			],
		};
	}

	buildSumMetric({
		name,
		value,
		unit,
		tags,
		useDouble = false,
	}: MetadataToBuildMetric): SumMetric {
		const timeUnixNano = this.getCurrentTimeNano();
		const attributes = this.createAttributes(tags);

		const dataPoint: DataPoint = {
			timeUnixNano,
			attributes,
		};

		if (useDouble) {
			dataPoint.asDouble = value;
		} else {
			dataPoint.asInt = Math.round(value);
		}

		const sumMetric: SumMetric = {
			name,
			unit,
			sum: {
				dataPoints: [dataPoint],
				aggregationTemporality: "AGGREGATION_TEMPORALITY_CUMULATIVE",
				isMonotonic: true,
			},
		};

		return sumMetric;
	}

	buildGaugeMetric({
		name,
		value,
		unit,
		tags,
		useDouble = true,
	}: MetadataToBuildMetric): GaugeMetric {
		const timeUnixNano = this.getCurrentTimeNano();
		const attributes = this.createAttributes(tags);

		const dataPoint: DataPoint = {
			timeUnixNano,
			attributes,
		};

		if (useDouble) {
			dataPoint.asDouble = value;
		} else {
			dataPoint.asInt = Math.round(value);
		}

		const gaugeMetric: GaugeMetric = {
			name,
			unit,
			gauge: {
				dataPoints: [dataPoint],
			},
		};

		return gaugeMetric;
	}

	async sendSumMetric(metadata: MetadataToBuildMetric): Promise<void> {
		const sumMetric: SumMetric = this.buildSumMetric(metadata);

		try {
			await this.sendMetrics<SumMetric>([sumMetric]);
		} catch (error) {
			console.error("Error sending sum metric:", error);
			throw error;
		}
	}

	async sendGaugeMetric(metadata: MetadataToBuildMetric): Promise<void> {
		const gaugeMetric: GaugeMetric = this.buildGaugeMetric(metadata);

		try {
			await this.sendMetrics<GaugeMetric>([gaugeMetric]);
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
				const responseText = await response.text();

				throw new Error(`Response not OK: ${responseText}`);
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
