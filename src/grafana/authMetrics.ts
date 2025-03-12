import { db } from "../database/database";
import { MetricBatcher } from "../utils/metricBatcher";
import metrics from "./metric";
import { metricConfig } from "./metricConfig";

interface LoginMetric {
	status: "success" | "failed";
	value: number;
}

// Create a batcher for login metrics
const loginBatcher = new MetricBatcher<LoginMetric>(
	async (items: LoginMetric[]) => {
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

		await metrics.sendMetrics(loginMetrics);
	},
	{ intervalMs: metricConfig.batchIntervalMs }
);

export function pushLoginMetricSuccess() {
	loginBatcher.push({ status: "success", value: 1 });
}

export function pushLoginMetricFailure() {
	loginBatcher.push({ status: "failed", value: 1 });
}

export async function sendActiveUsersCount() {
	const activeUsers = await db.getActiveUsersCount();

	await metrics.sendSumMetric({
		name: "active_users",
		unit: "count",
		value: activeUsers,
	});
}
