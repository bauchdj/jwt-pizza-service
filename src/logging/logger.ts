import { NextFunction, Request, Response } from "express";
import config from "../config";
import { StatusCodeError } from "../endpointHelper";
import { safelyParseStringOrJSONString } from "../utils/utils";

interface HttpLogData {
	authorized: boolean;
	path: string;
	method: string;
	statusCode: number;
	reqBody: string;
	resBody: string | object;
}

export interface DBLogData {
	query: string;
	params?: unknown[];
	duration?: number;
	rowCount?: number;
}

export interface FactoryLogData {
	method: string;
	path: string;
	statusCode: number;
	reqBody?: string;
}

interface ErrorLogData {
	message: string;
	status: number;
}

interface LogStream {
	stream: {
		component: string;
		level: string;
		type: string;
	};
	values: [string, string][];
}

interface LogEvent {
	streams: LogStream[];
}

class Logger {
	private log<
		T extends HttpLogData | DBLogData | FactoryLogData | ErrorLogData
	>(level: string, type: string, logData: T): void {
		const labels = {
			component: config.logging.source,
			level: level,
			type: type,
		};

		const values: [string, string] = [
			this.nowString(),
			this.sanitize(logData),
		];

		const logEvent: LogEvent = {
			streams: [{ stream: labels, values: [values] }],
		};

		void this.sendLogToGrafana(logEvent);
	}

	private statusToLogLevel(statusCode: number): string {
		if (statusCode >= 500) return "error";
		if (statusCode >= 400) return "warn";

		return "info";
	}

	private nowString(): string {
		return (Math.floor(Date.now()) * 1000000).toString();
	}

	private sanitize<T>(logData: T): string {
		let sanitizedData = JSON.stringify(logData);

		// Replace password values with ***** in stringified JSON
		sanitizedData = sanitizedData.replace(
			/"password":"[^"]*"/g,
			'"password":"*****"'
		);

		return sanitizedData;
	}

	private async sendLogToGrafana(event: LogEvent): Promise<void> {
		try {
			const res = await fetch(`${config.logging.url}`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${config.logging.userId}:${config.logging.apiKey}`,
				},
				body: JSON.stringify(event),
			});

			if (!res.ok) {
				console.log("Failed to send log to Grafana");
			}
		} catch (error) {
			console.log("Error sending log to Grafana:", error);
		}
	}

	// Arrow function to keep 'this' context
	httpLogger = (req: Request, res: Response, next: NextFunction): void => {
		const send = res.send;

		res.send = (resBody: string): Response => {
			const logData: HttpLogData = {
				authorized: !!req.headers.authorization,
				path: req.path,
				method: req.method,
				statusCode: res.statusCode,
				reqBody: req.body,
				resBody: safelyParseStringOrJSONString(resBody),
			};

			const level = this.statusToLogLevel(res.statusCode);

			this.log(level, "http", logData);
			res.send = send;

			return res.send(resBody);
		};

		next();
	};

	dbLogger(query: DBLogData): void {
		this.log("info", "db", query);
	}

	factoryLogger(data: FactoryLogData) {
		this.log("info", "factory", data);
	}

	unhandledErrorLogger(err: StatusCodeError): void {
		const errorData: ErrorLogData = {
			message: err.message,
			status: err.statusCode,
		};

		this.log("error", "unhandledError", errorData);
	}
}

// Export a singleton instance
const logger = new Logger();

export default logger;
