import express from "express";
import { readFile } from "fs/promises";
import config from "./config.js";
import { authRouter, setAuthUser } from "./routes/authRouter.js";
import franchiseRouter from "./routes/franchiseRouter.js";
import orderRouter from "./routes/orderRouter.js";

const version = JSON.parse(
	await readFile(new URL("./version.json", import.meta.url))
);

const app = express();
app.use(express.json());
app.use(setAuthUser);
app.use((req, res, next) => {
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

apiRouter.use("/docs", (req, res) => {
	res.json({
		version: version.version,
		endpoints: [
			...authRouter.endpoints,
			...orderRouter.endpoints,
			...franchiseRouter.endpoints,
		],
		config: { factory: config.factory.url, db: config.db.connection.host },
	});
});

app.get("/", (req, res) => {
	res.json({
		message: "welcome to JWT Pizza",
		version: version.version,
	});
});

app.use("*", (req, res) => {
	res.status(404).json({
		message: "unknown endpoint",
	});
});

// Default error handler for all exceptions and errors.
app.use((err, req, res, next) => {
	res.status(err.statusCode ?? 500).json({
		message: err.message,
		stack: err.stack,
	});
	next();
});

export default app;
