import { db } from "../database/database";
import { MetricBatcher, type MetricBatcherQueueItem } from "./metricBatcher";
import { metricConfig } from "./metricConfig";
import metrics, { SumMetric } from "./metrics";

interface LoginMetric extends MetricBatcherQueueItem {
	status: "success" | "failed";
}

// Create a batcher for login metrics
const loginBatcher = new MetricBatcher<LoginMetric, SumMetric>(
	async (items: LoginMetric[]): Promise<SumMetric[]> => {
		// Sum up all success and failure counts
		const successCount = items.reduce(
			(sum, item) => (item.status === "success" ? sum + item.value : sum),
			0
		);

		const failureCount = items.reduce(
			(sum, item) => (item.status === "failed" ? sum + item.value : sum),
			0
		);

		// Build sum metrics for login attempts
		const loginMetrics = [
			metrics.buildSumMetric({
				name: "login_attempts",
				value: successCount,
				unit: "count",
				tags: { status: "success" },
				useDouble: false, // Use integer for counts
			}),
			metrics.buildSumMetric({
				name: "login_attempts",
				value: failureCount,
				unit: "count",
				tags: { status: "failed" },
				useDouble: false, // Use integer for counts
			}),
		];

		return loginMetrics;
	},
	{ intervalMs: metricConfig.batchIntervalMs }
);

export function pushLoginMetricSuccess() {
	const status = "success";

	loginBatcher.push({ id: status, status, value: 1 });
}

export function pushLoginMetricFailure() {
	const status = "failed";

	loginBatcher.push({ id: status, status, value: 1 });
}

export async function sendActiveUsersCount() {
	const activeUsers = await db.getActiveUsersCount();

	await metrics.sendSumMetric({
		name: "active_users",
		unit: "count",
		value: activeUsers,
	});
}
