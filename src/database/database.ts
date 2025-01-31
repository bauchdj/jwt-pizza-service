import bcrypt from "bcrypt";
import mysql from "mysql2/promise";
import config from "../config.js";
import { StatusCodeError } from "../endpointHelper.js";
import {
	DinerOrder,
	Franchise,
	FranchiseAdmin,
	MenuItem,
	Role,
	Store,
	User,
	UserRole,
} from "../model/model.js";
import dbModel from "./dbModel.js";

class DB {
	initialized: Promise<void>;

	constructor() {
		this.initialized = this.initializeDatabase();
	}

	async getMenu(): Promise<mysql.RowDataPacket[]> {
		const connection = await this.getConnection();
		try {
			const rows = await this.query<mysql.RowDataPacket[]>(
				connection,
				`SELECT * FROM menu`,
				undefined
			);
			return rows;
		} finally {
			connection.end();
		}
	}

	async addMenuItem(item: MenuItem): Promise<MenuItem> {
		const connection = await this.getConnection();
		try {
			const addResult = await this.query<mysql.ResultSetHeader>(
				connection,
				`INSERT INTO menu (title, description, image, price) VALUES (?, ?, ?, ?)`,
				[item.title, item.description, item.image, item.price]
			);
			return { ...item, id: addResult.insertId };
		} finally {
			connection.end();
		}
	}

	async addUser(user: User): Promise<User> {
		const connection = await this.getConnection();
		try {
			const hashedPassword = await bcrypt.hash(user.password!, 10);

			const userResult = await this.query<mysql.ResultSetHeader>(
				connection,
				`INSERT INTO user (name, email, password) VALUES (?, ?, ?)`,
				[user.name, user.email, hashedPassword]
			);
			const userId = userResult.insertId;
			for (const role of user.roles) {
				switch (role.role) {
					case Role.Franchisee: {
						const franchiseId = await this.getID(
							connection,
							"name",
							// TODO I think I fixed a bug here using typescript lol
							role.objectId,
							"franchise"
						);
						await this.query(
							connection,
							`INSERT INTO userRole (userId, role, objectId) VALUES (?, ?, ?)`,
							[userId, role.role, franchiseId]
						);
						break;
					}
					default: {
						await this.query(
							connection,
							`INSERT INTO userRole (userId, role, objectId) VALUES (?, ?, ?)`,
							[userId, role.role, 0]
						);
						break;
					}
				}
			}
			return { ...user, id: userId, password: undefined };
		} finally {
			connection.end();
		}
	}

	async getUser(email: string, password: string): Promise<User> {
		const connection = await this.getConnection();
		try {
			const userResult = await this.query<mysql.RowDataPacket[]>(
				connection,
				`SELECT * FROM user WHERE email=?`,
				[email]
			);
			const user = userResult[0] as User;
			if (!user || !(await bcrypt.compare(password, user.password!))) {
				throw new StatusCodeError("unknown user", 404);
			}

			const roleResult = (await this.query<mysql.RowDataPacket[]>(
				connection,
				`SELECT * FROM userRole WHERE userId=?`,
				[user.id]
			)) as UserRole[];
			// TODO removed || undefined from objectId values expression
			const roles: UserRole[] = roleResult.map((r: UserRole) => {
				return { ...r, objectId: r.objectId, role: r.role };
			});

			return { ...user, roles: roles, password: undefined };
		} finally {
			connection.end();
		}
	}

	async updateUser(
		userId: number,
		email?: string,
		password?: string
	): Promise<User> {
		const connection = await this.getConnection();
		try {
			const params: string[] = [];
			if (password) {
				const hashedPassword = await bcrypt.hash(password, 10);
				params.push(`password='${hashedPassword}'`);
			}
			if (email) {
				params.push(`email='${email}'`);
			}
			if (params.length > 0) {
				const query = `UPDATE user SET ${params.join(
					", "
				)} WHERE id=${userId}`;
				await this.query(connection, query);
			}
			return this.getUser(email!, password!);
		} finally {
			connection.end();
		}
	}

	async loginUser(userId: number, token: string): Promise<void> {
		token = this.getTokenSignature(token);
		const connection = await this.getConnection();
		try {
			await this.query(
				connection,
				`INSERT INTO auth (token, userId) VALUES (?, ?)`,
				[token, userId]
			);
		} finally {
			connection.end();
		}
	}

	async isLoggedIn(token: string): Promise<boolean> {
		token = this.getTokenSignature(token);
		const connection = await this.getConnection();
		try {
			const authResult = await this.query<mysql.RowDataPacket[]>(
				connection,
				`SELECT userId FROM auth WHERE token=?`,
				[token]
			);
			return authResult.length > 0;
		} finally {
			connection.end();
		}
	}

	async logoutUser(token: string): Promise<void> {
		token = this.getTokenSignature(token);
		const connection = await this.getConnection();
		try {
			await this.query(connection, `DELETE FROM auth WHERE token=?`, [
				token,
			]);
		} finally {
			connection.end();
		}
	}

	async getOrders(
		user: User,
		page = 1
	): Promise<{
		dinerId: number;
		orders: mysql.RowDataPacket[];
		page: number;
	}> {
		const connection = await this.getConnection();
		try {
			const offset = this.getOffset(page, config.db.listPerPage);
			const orders = await this.query<mysql.RowDataPacket[]>(
				connection,
				`SELECT id, franchiseId, storeId, date FROM dinerOrder WHERE dinerId=? LIMIT ${offset},${config.db.listPerPage}`,
				[user.id]
			);
			for (const order of orders) {
				const items = await this.query<mysql.RowDataPacket[]>(
					connection,
					`SELECT id, menuId, description, price FROM orderItem WHERE orderId=?`,
					[order.id]
				);
				order.items = items;
			}
			return { dinerId: user.id!, orders, page };
		} finally {
			connection.end();
		}
	}

	async addDinerOrder(user: User, order: DinerOrder): Promise<DinerOrder> {
		const connection = await this.getConnection();
		try {
			const orderResult = await this.query<mysql.ResultSetHeader>(
				connection,
				`INSERT INTO dinerOrder (dinerId, franchiseId, storeId, date) VALUES (?, ?, ?, now())`,
				[user.id, order.franchiseId, order.storeId]
			);
			const orderId = orderResult.insertId;
			for (const item of order.items) {
				const menuId = await this.getID(
					connection,
					"id",
					// TODO toString() removed hmm...
					item.menuId,
					"menu"
				);
				await this.query(
					connection,
					`INSERT INTO orderItem (orderId, menuId, description, price) VALUES (?, ?, ?, ?)`,
					[orderId, menuId, item.description, item.price]
				);
			}
			return { ...order, id: orderId };
		} finally {
			connection.end();
		}
	}

	async createFranchise(franchise: Franchise): Promise<Franchise> {
		const connection = await this.getConnection();
		try {
			// TODO sus of this admins prop on franchise, not in table
			for (const admin of franchise.admins) {
				const adminUser = (await this.query<mysql.RowDataPacket[]>(
					connection,
					`SELECT id, name FROM user WHERE email=?`,
					[admin.email]
				)) as User[];
				if (adminUser.length == 0) {
					throw new StatusCodeError(
						`unknown user for franchise admin ${admin.email} provided`,
						404
					);
				}
				admin.id = adminUser[0].id;
				admin.name = adminUser[0].name;
			}

			const franchiseResult = await this.query<mysql.ResultSetHeader>(
				connection,
				`INSERT INTO franchise (name) VALUES (?)`,
				[franchise.name]
			);
			franchise.id = franchiseResult.insertId;

			for (const admin of franchise.admins) {
				await this.query(
					connection,
					`INSERT INTO userRole (userId, role, objectId) VALUES (?, ?, ?)`,
					[admin.id, Role.Franchisee, franchise.id]
				);
			}

			return franchise;
		} finally {
			connection.end();
		}
	}

	async deleteFranchise(franchiseId: number): Promise<void> {
		const connection = await this.getConnection();
		try {
			await connection.beginTransaction();
			try {
				await this.query(
					connection,
					`DELETE FROM store WHERE franchiseId=?`,
					[franchiseId]
				);
				await this.query(
					connection,
					`DELETE FROM userRole WHERE objectId=?`,
					[franchiseId]
				);
				await this.query(
					connection,
					`DELETE FROM franchise WHERE id=?`,
					[franchiseId]
				);
				await connection.commit();
			} catch {
				await connection.rollback();
				throw new StatusCodeError("unable to delete franchise", 500);
			}
		} finally {
			connection.end();
		}
	}

	async getFranchises(authUser: User): Promise<Franchise[]> {
		const connection = await this.getConnection();
		try {
			const franchises = (await this.query<mysql.RowDataPacket[]>(
				connection,
				`SELECT id, name FROM franchise`,
				undefined
			)) as Franchise[];
			for (const franchise of franchises) {
				if (authUser?.roles.some((role) => role.role === Role.Admin)) {
					await this.getFranchise(franchise);
				} else {
					franchise.stores = (await this.query(
						connection,
						`SELECT id, name FROM store WHERE franchiseId=?`,
						[franchise.id]
					)) as Store[];
				}
			}
			return franchises;
		} finally {
			connection.end();
		}
	}

	async getUserFranchises(userId: number): Promise<Franchise[]> {
		const connection = await this.getConnection();
		try {
			const franchiseRows = await this.query<mysql.RowDataPacket[]>(
				connection,
				`SELECT objectId FROM userRole WHERE role='franchisee' AND userId=?`,
				[userId]
			);
			if (franchiseRows.length === 0) {
				return [];
			}

			const franchiseIds = franchiseRows.map((v) => v.objectId as number);
			const franchises = (await this.query<mysql.RowDataPacket[]>(
				connection,
				`SELECT id, name FROM franchise WHERE id in (${franchiseIds.join(
					","
				)})`,
				undefined
			)) as Franchise[];
			for (const franchise of franchises) {
				await this.getFranchise(franchise);
			}
			return franchises;
		} finally {
			connection.end();
		}
	}

	async getFranchise(franchise: Franchise): Promise<Franchise> {
		const connection = await this.getConnection();
		try {
			franchise.admins = (await this.query(
				connection,
				`SELECT u.id, u.name, u.email FROM userRole AS ur JOIN user AS u ON u.id=ur.userId WHERE ur.objectId=? AND ur.role='franchisee'`,
				[franchise.id]
			)) as FranchiseAdmin[];
			franchise.stores = (await this.query(
				connection,
				`SELECT id, name FROM store WHERE franchiseId=?`,
				[franchise.id]
			)) as Store[];
			return franchise;
		} finally {
			connection.end();
		}
	}

	async createStore(franchiseId: number, store: Store): Promise<Store> {
		const connection = await this.getConnection();
		try {
			const insertResult = await this.query<mysql.ResultSetHeader>(
				connection,
				`INSERT INTO store (franchiseId, name) VALUES (?, ?)`,
				[franchiseId, store.name]
			);
			return { id: insertResult.insertId, franchiseId, name: store.name };
		} finally {
			connection.end();
		}
	}

	async deleteStore(franchiseId: number, storeId: number) {
		const connection = await this.getConnection();
		try {
			await this.query(
				connection,
				`DELETE FROM store WHERE franchiseId=? AND id=?`,
				[franchiseId, storeId]
			);
		} finally {
			connection.end();
		}
	}

	getTokenSignature(token: string): string {
		const parts = token.split(".");
		if (parts.length > 2) {
			return parts[2];
		}
		return "";
	}

	getOffset(page: number, listPerPage: number): number {
		return (page - 1) * listPerPage;
	}

	async query<T extends mysql.QueryResult>(
		connection: mysql.Connection,
		sql: string,
		params?: unknown[]
	): Promise<T> {
		const [rows] = await connection.execute<T>(sql, params);
		return rows;
	}

	async getID(
		connection: mysql.Connection,
		field: string,
		value: number,
		table: string
	): Promise<number> {
		const result = await this.query<mysql.RowDataPacket[]>(
			connection,
			`SELECT id FROM ${table} WHERE ${field}=?`,
			[value]
		);
		if (result.length > 0) {
			return result[0].id;
		} else {
			throw new StatusCodeError(`${table} not found`, 404);
		}
	}

	async getConnection() {
		// TODO Make sure the database is initialized before trying to get a connection.
		await this.initialized;
		return this._getConnection();
	}

	async _getConnection(setUse = true) {
		const connection = await mysql.createConnection({
			host: config.db.connection.host,
			user: config.db.connection.user,
			password: config.db.connection.password,
			connectTimeout: config.db.connection.connectTimeout,
			decimalNumbers: true,
		});
		if (setUse) {
			await connection.query(`USE ${config.db.connection.database}`);
		}
		return connection;
	}

	async initializeDatabase() {
		try {
			const connection = await this._getConnection(false);
			try {
				const dbExists = await this.checkDatabaseExists(connection);
				console.log(
					dbExists
						? "Database exists"
						: "Database does not exist, creating it"
				);

				await connection.query(
					`CREATE DATABASE IF NOT EXISTS ${config.db.connection.database}`
				);
				await connection.query(`USE ${config.db.connection.database}`);

				if (!dbExists) {
					console.log("Successfully created database");
				}

				for (const statement of dbModel.tableCreateStatements) {
					await connection.query(statement);
				}

				if (!dbExists) {
					const defaultAdmin: User = {
						name: "常用名字",
						email: "a@jwt.com",
						password: "admin",
						// TODO no objectId hmm...
						roles: [{ role: Role.Admin, objectId: 0 }],
					};
					this.addUser(defaultAdmin);
				}
			} finally {
				connection.end();
			}
		} catch (err) {
			// TODO if (!(err instanceof Error)) return;
			console.error(
				JSON.stringify({
					message: "Error initializing database",
					// @ts-expect-error TS(2571): Object is of type 'unknown'.
					exception: err.message,
					connection: config.db.connection,
				})
			);
		}
	}

	async checkDatabaseExists(connection: mysql.Connection) {
		const [rows] = await connection.execute<mysql.RowDataPacket[]>(
			`SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?`,
			[config.db.connection.database]
		);
		return rows.length > 0;
	}
}

const db = new DB();
export { db as DB };
