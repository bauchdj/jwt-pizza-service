import express, { NextFunction, Request, Response } from "express";
import config from "./config";
import { StatusCodeError } from "./endpointHelper";
import { latencyMetricsMiddleware } from "./grafana/latencyMetrics";
import { requestMetricsMiddleware } from "./grafana/requestMetrics";
import systemMetrics from "./grafana/systemMetrics";
import { authRouter, setAuthUser } from "./routes/authRouter";
import franchiseRouter from "./routes/franchiseRouter";
import orderRouter from "./routes/orderRouter";
import version from "./version.json";

const app = express();

app.use(express.json());
app.use(requestMetricsMiddleware);
app.use(latencyMetricsMiddleware);
app.use(setAuthUser);

// Start collecting system metrics
systemMetrics.start();

// Cleanup on process termination
process.on("SIGTERM", () => {
	systemMetrics.stop();
});

process.on("SIGINT", () => {
	systemMetrics.stop();
});

app.use((req: Request, res: Response, next: NextFunction) => {
	res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
	res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");

	res.setHeader(
		"Access-Control-Allow-Headers",
		"Content-Type, Authorization"
	);

	res.setHeader("Access-Control-Allow-Credentials", "true");
	next();
});

const apiRouter = express.Router();

app.use("/api", apiRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/order", orderRouter);
apiRouter.use("/franchise", franchiseRouter);

apiRouter.use("/docs", (req: Request, res: Response) => {
	res.json({
		version: version.version,
		endpoints: [
			...(authRouter.endpoints || []),
			...(orderRouter.endpoints || []),
			...(franchiseRouter.endpoints || []),
		],
		config: {
			factory: config.factory.url,
			db: config.db.connection.host,
		},
	});
});

app.get("/", (req: Request, res: Response) => {
	res.json({
		message: "welcome to JWT Pizza",
		version: version.version,
	});
});

app.use("*", (req: Request, res: Response) => {
	res.status(404).json({
		message: "unknown endpoint",
	});
});

// Default error handler for all exceptions and errors
app.use(
	(err: StatusCodeError, req: Request, res: Response, next: NextFunction) => {
		const status = err.statusCode ?? 500;

		res.status(status).json({
			message: err.message,
			stack:
				process.env.NODE_ENV === "production" ? undefined : err.stack,
		});

		if (!status) next();
	}
);

export default app;
