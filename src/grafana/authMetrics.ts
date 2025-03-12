import { db } from "../database/database";
import { MetricBatcher } from "../utils/metricBatcher";
import metrics from "./metric";

interface LoginMetric {
	status: string;
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

		const successMetric = metrics.buildSumMetric({
			name: "auth_login",
			value: successCount,
			tags: { status: "success" },
		});

		const failureMetric = metrics.buildSumMetric({
			name: "auth_login",
			value: failureCount,
			tags: { status: "failed" },
		});

		await metrics.sendMetrics([successMetric, failureMetric]);
	},
	60000 // Send every minute
);

export function sendLoginMetricSuccess() {
	loginBatcher.push({ status: "success", value: 1 });
}

export function sendLoginMetricFailed() {
	loginBatcher.push({ status: "failed", value: 1 });
}

export async function sendActiveUsersCount() {
	const activeUsers = await db.getActiveUsersCount();

	await metrics.sendSumMetric({
		name: "active_users",
		value: activeUsers,
	});
}
