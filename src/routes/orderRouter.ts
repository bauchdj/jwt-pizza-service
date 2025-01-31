import express, { Response } from "express";
import config from "../config.js";
import { db } from "../database/database.js";
import { asyncHandler, StatusCodeError } from "../endpointHelper.js";
import { Role } from "../model/model.js";
import { authRouter } from "./authRouter.js";
import { ExtendedRouter, UserRequest } from "./RouterModels.js";

const orderRouter: ExtendedRouter = express.Router() as ExtendedRouter;

orderRouter.endpoints = [
	{
		method: "GET",
		path: "/api/order/menu",
		description: "Get the pizza menu",
		example: `curl localhost:3000/api/order/menu`,
		response: [
			{
				id: 1,
				title: "Veggie",
				image: "pizza1.png",
				price: 0.0038,
				description: "A garden of delight",
			},
		],
	},
	{
		method: "PUT",
		path: "/api/order/menu",
		requiresAuth: true,
		description: "Add an item to the menu",
		example: `curl -X PUT localhost:3000/api/order/menu -H 'Content-Type: application/json' -d '{ "title":"Student", "description": "No topping, no sauce, just carbs", "image":"pizza9.png", "price": 0.0001 }'  -H 'Authorization: Bearer tttttt'`,
		response: [
			{
				id: 1,
				title: "Student",
				description: "No topping, no sauce, just carbs",
				image: "pizza9.png",
				price: 0.0001,
			},
		],
	},
	{
		method: "GET",
		path: "/api/order",
		requiresAuth: true,
		description: "Get the orders for the authenticated user",
		example: `curl -X GET localhost:3000/api/order  -H 'Authorization: Bearer tttttt'`,
		response: {
			dinerId: 4,
			orders: [
				{
					id: 1,
					franchiseId: 1,
					storeId: 1,
					date: "2024-06-05T05:14:40.000Z",
					items: [
						{
							id: 1,
							menuId: 1,
							description: "Veggie",
							price: 0.05,
						},
					],
				},
			],
			page: 1,
		},
	},
	{
		method: "POST",
		path: "/api/order",
		requiresAuth: true,
		description: "Create an order for the authenticated user",
		example: `curl -X POST localhost:3000/api/order -H 'Content-Type: application/json' -d '{"franchiseId": 1, "storeId":1, "items":[{ "menuId": 1, "description": "Veggie", "price": 0.05 }]}'  -H 'Authorization: Bearer tttttt'`,
		response: {
			order: {
				franchiseId: 1,
				storeId: 1,
				items: [{ menuId: 1, description: "Veggie", price: 0.05 }],
				id: 1,
			},
			jwt: "1111111111",
		},
	},
];

// getMenu
orderRouter.get(
	"/menu",
	asyncHandler((async (req: UserRequest, res: Response) => {
		res.send(await db.getMenu());
	}) as unknown as express.RequestHandler)
);

// addMenuItem
orderRouter.put(
	"/menu",
	authRouter.authenticateToken,
	asyncHandler((async (req: UserRequest, res: Response) => {
		if (!req.user.isRole(Role.Admin)) {
			throw new StatusCodeError("unable to add menu item", 403);
		}

		const addMenuItemReq = req.body;
		await db.addMenuItem(addMenuItemReq);
		res.send(await db.getMenu());
	}) as unknown as express.RequestHandler)
);

// getOrders
orderRouter.get(
	"/",
	authRouter.authenticateToken,
	asyncHandler((async (req: UserRequest, res: Response) => {
		const page = req.query.page
			? parseInt(req.query.page as string, 10)
			: undefined;
		res.json(await db.getOrders(req.user, page));
	}) as unknown as express.RequestHandler)
);

// createOrder
orderRouter.post(
	"/",
	authRouter.authenticateToken,
	asyncHandler((async (req: UserRequest, res: Response) => {
		const orderReq = req.body;
		const order = await db.addDinerOrder(req.user, orderReq);

		const response = await fetch(`${config.factory.url}/api/order`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				authorization: `Bearer ${config.factory.apiKey}`,
			},
			body: JSON.stringify({
				diner: {
					id: req.user.id,
					name: req.user.name,
					email: req.user.email,
				},
				order,
			}),
		});

		const jsonResponse = await response.json();

		if (response.ok) {
			res.send({
				order,
				reportSlowPizzaToFactoryUrl: jsonResponse.reportUrl,
				jwt: jsonResponse.jwt,
			});
		} else {
			res.status(500).send({
				message: "Failed to fulfill order at factory",
				reportPizzaCreationErrorToPizzaFactoryUrl:
					jsonResponse.reportUrl,
			});
		}
	}) as unknown as express.RequestHandler)
);

export default orderRouter;
