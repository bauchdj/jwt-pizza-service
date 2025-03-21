import express, { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import config from "../config";
import { db } from "../database/database";
import { asyncHandler, StatusCodeError } from "../endpointHelper";
import {
	pushLoginMetricFailure,
	pushLoginMetricSuccess,
	sendActiveUsersCount,
} from "../metrics/authMetrics";
import { Role, RoleValueType, User } from "../model/model";
import { ExtendedRouter, RequestUser } from "./RouterModels";

interface AuthenticatedRequest extends Request {
	user?: RequestUser;
}

interface AuthRouter extends ExtendedRouter {
	authenticateToken: express.RequestHandler;
}

const authRouter: AuthRouter = express.Router() as AuthRouter;

authRouter.endpoints = [
	{
		method: "POST",
		path: "/api/auth",
		description: "Register a new user",
		example: `curl -X POST localhost:3000/api/auth -d '{"name":"pizza diner", "email":"d@jwt.com", "password":"diner"}' -H 'Content-Type: application/json'`,
		response: {
			user: {
				id: 2,
				name: "pizza diner",
				email: "d@jwt.com",
				roles: [{ role: "diner" }],
			},
			token: "tttttt",
		},
	},
	{
		method: "PUT",
		path: "/api/auth",
		description: "Login existing user",
		example: `curl -X PUT localhost:3000/api/auth -d '{"email":"a@jwt.com", "password":"admin"}' -H 'Content-Type: application/json'`,
		response: {
			user: {
				id: 1,
				name: "常用名字",
				email: "a@jwt.com",
				roles: [{ role: "admin" }],
			},
			token: "tttttt",
		},
	},
	{
		method: "PUT",
		path: "/api/auth/:userId",
		requiresAuth: true,
		description: "Update user",
		example: `curl -X PUT localhost:3000/api/auth/1 -d '{"email":"a@jwt.com", "password":"admin"}' -H 'Content-Type: application/json' -H 'Authorization: Bearer tttttt'`,
		response: {
			id: 1,
			name: "常用名字",
			email: "a@jwt.com",
			roles: [{ role: "admin" }],
		},
	},
	{
		method: "DELETE",
		path: "/api/auth",
		requiresAuth: true,
		description: "Logout a user",
		example: `curl -X DELETE localhost:3000/api/auth -H 'Authorization: Bearer tttttt'`,
		response: { message: "logout successful" },
	},
];

async function setAuthUser(
	req: AuthenticatedRequest,
	res: Response,
	next: NextFunction
) {
	const token = readAuthToken(req);

	if (token) {
		try {
			if (await db.isLoggedIn(token)) {
				const decoded = jwt.verify(token, config.jwtSecret) as User;

				const user: RequestUser = {
					...decoded,
					isRole: (role: RoleValueType) =>
						!!decoded.roles.find((r) => r.role === role),
				};

				req.user = user as RequestUser;
			}
		} catch {
			req.user = undefined;
		}
	}

	next();
}

authRouter.authenticateToken = ((
	req: AuthenticatedRequest,
	res: Response,
	next: NextFunction
) => {
	if (!req.user) {
		return res.status(401).send({ message: "unauthorized" });
	}

	next();
}) as express.RequestHandler;

// Register
authRouter.post(
	"/",
	asyncHandler((async (req: Request, res: Response) => {
		const { name, email, password } = req.body;

		if (!name || !email || !password) {
			void pushLoginMetricFailure();

			return res
				.status(400)
				.json({ message: "name, email, and password are required" });
		}

		try {
			const user = await db.addUser({
				name,
				email,
				password,
				roles: [{ role: Role.Diner, objectId: 0 }],
			});

			const token = await setAuth(user);

			void pushLoginMetricSuccess();

			res.json({ user, token });
		} catch (error: unknown) {
			if (error instanceof StatusCodeError) {
				void pushLoginMetricFailure();

				return res
					.status(error.statusCode)
					.json({ message: error.message });
			}

			throw error;
		}
	}) as express.RequestHandler)
);

// Login
authRouter.put(
	"/",
	asyncHandler(async (req: Request, res: Response) => {
		const { email, password } = req.body;

		try {
			const user = await db.getUser(email, password);
			const token = await setAuth(user);

			void pushLoginMetricSuccess();

			res.json({ user, token });
		} catch (error: unknown) {
			void pushLoginMetricFailure();

			if (error instanceof StatusCodeError) {
				res.status(error.statusCode).json({ message: error.message });
			}

			throw error;
		}
	})
);

// Logout
authRouter.delete(
	"/",
	authRouter.authenticateToken,
	asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
		await clearAuth(req);
		res.json({ message: "logout successful" });
	})
);

// Update User
authRouter.put(
	"/:userId",
	authRouter.authenticateToken,
	asyncHandler((async (req: AuthenticatedRequest, res: Response) => {
		const { email, password } = req.body;
		const userId = Number(req.params.userId);
		const user = req.user;

		if (!user || (user.id !== userId && !user.isRole(Role.Admin))) {
			return res.status(403).json({ message: "unauthorized" });
		}

		const updatedUser = await db.updateUser(userId, email, password);

		res.json(updatedUser);
	}) as express.RequestHandler)
);

async function setAuth(user: User): Promise<string> {
	const token = jwt.sign(user, config.jwtSecret);

	await db.loginUser(user.id!, token);
	void sendActiveUsersCount();

	return token;
}

async function clearAuth(req: AuthenticatedRequest) {
	const token = readAuthToken(req);

	if (token) {
		await db.logoutUser(token);
		void sendActiveUsersCount();
	}
}

function readAuthToken(req: Request): string | null {
	const authHeader = req.headers.authorization;

	return authHeader ? authHeader.split(" ")[1] : null;
}

export { authRouter, setAuthUser };
