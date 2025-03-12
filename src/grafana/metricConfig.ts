const isDevelopment = process.env.NODE_ENV === "development";

export const metricConfig = {
	// Default batch interval is 1 minute in production, 5 seconds in development
	batchIntervalMs: isDevelopment ? 5000 : 60000,

	// Default collection interval is 10 seconds in production, 2 seconds in development
	collectionIntervalMs: isDevelopment ? 2000 : 10000,
};
