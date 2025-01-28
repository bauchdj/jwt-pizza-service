import express, { Request, Response } from "express";
import { DB } from "../database/database.js";
import { StatusCodeError, asyncHandler } from "../endpointHelper.js";
import { Franchise, Role } from "../model/model.js";
import { authRouter } from "./authRouter.js";
import { ExtendedRouter, RequestUser } from "./RouterModels.js";

const franchiseRouter: ExtendedRouter = express.Router();

franchiseRouter.endpoints = [
	{
		method: "GET",
		path: "/api/franchise",
		description: "List all the franchises",
		example: `curl localhost:3000/api/franchise`,
		response: [
			{
				id: 1,
				name: "pizzaPocket",
				admins: [
					{ id: 4, name: "pizza franchisee", email: "f@jwt.com" },
				],
				stores: [{ id: 1, name: "SLC", totalRevenue: 0 }],
			},
		],
	},
	{
		method: "GET",
		path: "/api/franchise/:userId",
		requiresAuth: true,
		description: `List a user's franchises`,
		example: `curl localhost:3000/api/franchise/4  -H 'Authorization: Bearer tttttt'`,
		response: [
			{
				id: 2,
				name: "pizzaPocket",
				admins: [
					{ id: 4, name: "pizza franchisee", email: "f@jwt.com" },
				],
				stores: [{ id: 4, name: "SLC", totalRevenue: 0 }],
			},
		],
	},
	{
		method: "POST",
		path: "/api/franchise",
		requiresAuth: true,
		description: "Create a new franchise",
		example: `curl -X POST localhost:3000/api/franchise -H 'Content-Type: application/json' -H 'Authorization: Bearer tttttt' -d '{"name": "pizzaPocket", "admins": [{"email": "f@jwt.com"}]}'`,
		response: {
			name: "pizzaPocket",
			admins: [{ email: "f@jwt.com", id: 4, name: "pizza franchisee" }],
			id: 1,
		},
	},
	{
		method: "DELETE",
		path: "/api/franchise/:franchiseId",
		requiresAuth: true,
		description: `Delete a franchise`,
		example: `curl -X DELETE localhost:3000/api/franchise/1 -H 'Authorization: Bearer tttttt'`,
		response: { message: "franchise deleted" },
	},
	{
		method: "POST",
		path: "/api/franchise/:franchiseId/store",
		requiresAuth: true,
		description: "Create a new franchise store",
		example: `curl -X POST localhost:3000/api/franchise/1/store -H 'Content-Type: application/json' -d '{"franchiseId": 1, "name":"SLC"}' -H 'Authorization: Bearer tttttt'`,
		response: { id: 1, name: "SLC", totalRevenue: 0 },
	},
	{
		method: "DELETE",
		path: "/api/franchise/:franchiseId/store/:storeId",
		requiresAuth: true,
		description: `Delete a store`,
		example: `curl -X DELETE localhost:3000/api/franchise/1/store/1  -H 'Authorization: Bearer tttttt'`,
		response: { message: "store deleted" },
	},
];

// getFranchises
franchiseRouter.get(
	"/",
	asyncHandler(async (req: Request, res: Response) => {
		res.json(await DB.getFranchises((req as any).user));
	})
);

// getUserFranchises
franchiseRouter.get(
	"/:userId",
	authRouter.authenticateToken,
	asyncHandler(async (req: Request, res: Response) => {
		const userId = Number(req.params.userId);
		let result: Franchise[] = [];
		const user = (req as any).user as RequestUser;

		if (user.id === userId || user.isRole(Role.Admin)) {
			result = await DB.getUserFranchises(userId);
		}

		res.json(result);
	})
);

// createFranchise
franchiseRouter.post(
	"/",
	authRouter.authenticateToken,
	asyncHandler(async (req: Request, res: Response) => {
		const user = (req as any).user as RequestUser;

		if (!user.isRole(Role.Admin)) {
			throw new StatusCodeError("unable to create a franchise", 403);
		}

		const franchise = req.body;
		res.send(await DB.createFranchise(franchise));
	})
);

// deleteFranchise
franchiseRouter.delete(
	"/:franchiseId",
	authRouter.authenticateToken,
	asyncHandler(async (req: Request, res: Response) => {
		const user = (req as any).user as RequestUser;

		if (!user.isRole(Role.Admin)) {
			throw new StatusCodeError("unable to delete a franchise", 403);
		}

		const franchiseId = Number(req.params.franchiseId);
		await DB.deleteFranchise(franchiseId);
		res.json({ message: "franchise deleted" });
	})
);

// createStore
franchiseRouter.post(
	"/:franchiseId/store",
	authRouter.authenticateToken,
	asyncHandler(async (req: Request, res: Response) => {
		const franchiseId = await getFranchiseIdIfAdmin(req);
		res.send(await DB.createStore(franchiseId, req.body));
	})
);

// deleteStore
franchiseRouter.delete(
	"/:franchiseId/store/:storeId",
	authRouter.authenticateToken,
	asyncHandler(async (req: Request, res: Response) => {
		const franchiseId = await getFranchiseIdIfAdmin(req);

		const storeId = Number(req.params.storeId);
		await DB.deleteStore(franchiseId, storeId);
		res.json({ message: "store deleted" });
	})
);

async function getFranchiseIdIfAdmin(req: Request) {
	const franchiseId = Number(req.params.franchiseId);
	const user = (req as any).user as RequestUser;
	// TODO this franchise object does not have all the info necessary
	const franchise = await DB.getFranchise({ id: franchiseId } as Franchise);
	if (
		!franchise ||
		(!user.isRole(Role.Admin) &&
			!franchise.admins.some((admin) => admin.id === user.id))
	) {
		throw new StatusCodeError("unable to delete a store", 403);
	}
	return franchiseId;
}

export default franchiseRouter;
