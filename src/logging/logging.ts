import config from "../config";

export interface LogValue {
	timestamp: string;
	message: string;
}

interface LogStream {
	stream: {
		Language: string;
		source: string;
		[key: string]: string; // Allow additional labels
	};
	values: [string, string][]; // [timestamp, message] pairs
}

interface LogRequest {
	streams: LogStream[];
}

interface LogEntry {
	message: string;
	labels?: Record<string, string>;
}

class LoggingClient {
	private static readonly DEFAULT_HEADERS = {
		"Content-Type": "application/json",
	};

	private readonly endpoint: string;
	private readonly source: string;
	private readonly apiKey: string;

	constructor(
		endpoint: string = config.logging.url,
		source: string = config.logging.source,
		apiKey: string = config.logging.apiKey
	) {
		this.endpoint = endpoint;
		this.source = source;
		this.apiKey = apiKey;
	}

	private getCurrentTimeNano(): string {
		return (Math.floor(Date.now() / 1000) * 1000000000).toString();
	}

	private getHeaders(): Record<string, string> {
		return {
			...LoggingClient.DEFAULT_HEADERS,
			Authorization: `Bearer ${this.apiKey}`,
		};
	}

	private createStream(
		message: string,
		labels: Record<string, string> = {}
	): LogStream {
		return {
			stream: {
				Language: "NodeJS",
				source: this.source,
				...labels,
			},
			values: [[this.getCurrentTimeNano(), message]],
		};
	}

	private async postLogs(logRequest: LogRequest): Promise<void> {
		try {
			const response = await fetch(this.endpoint, {
				method: "POST",
				headers: this.getHeaders(),
				body: JSON.stringify(logRequest),
			});

			if (!response.ok) {
				throw new Error(`Failed to send logs: ${response.statusText}`);
			}
		} catch (error: unknown) {
			console.error("Error sending logs:", error);
			throw error;
		}
	}

	async log(
		message: string,
		labels: Record<string, string> = {}
	): Promise<void> {
		const logRequest: LogRequest = {
			streams: [this.createStream(message, labels)],
		};

		await this.postLogs(logRequest);
	}

	async logBatch(entries: LogEntry[]): Promise<void> {
		const logRequest: LogRequest = {
			streams: entries.map((entry) =>
				this.createStream(entry.message, entry.labels || {})
			),
		};

		await this.postLogs(logRequest);
	}
}

// Export a singleton instance
const logging = new LoggingClient();

export default logging;
