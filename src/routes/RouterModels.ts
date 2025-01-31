import { Request, Response, Router } from "express";
import { MenuItem, RoleValueType, User } from "../model/model";

export interface FranchiseGetItems {
	id: number;
	name: string;
	admins: {
		id: number;
		name: string;
		email: string;
	}[];
	stores: {
		id: number;
		name: string;
		totalRevenue: number;
	}[];
}

export interface Endpoint {
	method: string;
	path: string;
	description: string;
	example: string;
	response: Record<string, unknown> | FranchiseGetItems[] | MenuItem[];
	requiresAuth?: boolean;
}

export interface ExtendedRouter extends Router {
	endpoints?: Endpoint[];
}

export interface RequestUser extends User {
	isRole: (role: RoleValueType) => boolean;
}

export interface UserRequest extends Request {
	user: RequestUser;
}

export type UserRequestHandler = (req: UserRequest, res: Response) => unknown;
