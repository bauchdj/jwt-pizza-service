import express, { NextFunction, Request, Response } from "express";
import config from "./config.js";
import { authRouter, setAuthUser } from "./routes/authRouter.js";
import franchiseRouter from "./routes/franchiseRouter.js";
import orderRouter from "./routes/orderRouter.js";
import version from "./version.json";

const app = express();
app.use(express.json());
app.use(setAuthUser);

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
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
	res.status((err as any).statusCode ?? 500).json({
		message: err.message,
		stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
	});
});

export default app;
