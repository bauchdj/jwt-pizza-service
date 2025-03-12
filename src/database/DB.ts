import argon2 from "argon2";
import mysql from "mysql2/promise";
import config from "../config";
import { StatusCodeError } from "../endpointHelper";
import {
	DinerOrder,
	Franchise,
	FranchiseAdmin,
	MenuItem,
	OrderItem,
	Role,
	Store,
	User,
	UserRole,
} from "../model/model";
import dbModel from "./dbModel";

class DB {
	private connection: mysql.Connection | null;
	private connectionTimeout: NodeJS.Timeout | null;
	private config: typeof config;
	private initialized: Promise<boolean>;

	constructor(dbConfig = config) {
		this.connection = null;
		this.connectionTimeout = null;
		this.config = dbConfig;
		this.initialized = this.initializeDatabase();
	}

	async getMenu(): Promise<MenuItem[]> {
		const connection = await this.getConnection();

		try {
			const rows = await this.query<mysql.RowDataPacket[]>(
				connection,
				`SELECT * FROM menu`,
				undefined
			);

			return rows as MenuItem[];
		} finally {
			this.setCloseConnectionTimeout();
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
			this.setCloseConnectionTimeout();
		}
	}

	async addUser(user: User): Promise<User> {
		const connection = await this.getConnection();

		try {
			try {
				const dbUserFromGet = await this.getUserByEmail(user.email);

				if (dbUserFromGet) {
					throw new StatusCodeError("user already exists", 409);
				}
			} catch (error: unknown) {
				if ((error as StatusCodeError).statusCode === 404) {
					// user does not exist
				} else {
					throw error;
				}
			}

			const hashedPassword = await argon2.hash(user.password!);

			const userResult = await this.query<mysql.ResultSetHeader>(
				connection,
				`INSERT INTO user (name, email, password) VALUES (?, ?, ?)`,
				[user.name, user.email, hashedPassword]
			);

			const userId = userResult.insertId;

			for (const role of user.roles) {
				switch (role.role) {
					// case Role.Franchisee: {
					// 	// TODO you cannot add a franchisee without the franchise existing...
					// 	const franchiseId = await this.getID(
					// 		connection,
					// 		"name",
					// 		// TODO I think I fixed a bug here using typescript lol
					// 		role.objectId,
					// 		"franchise"
					// 	);
					// 	await this.query(
					// 		connection,
					// 		`INSERT INTO userRole (userId, role, objectId) VALUES (?, ?, ?)`,
					// 		[userId, role.role, franchiseId]
					// 	);
					// 	break;
					// }
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
			this.setCloseConnectionTimeout();
		}
	}

	async getUser(email: string, password: string): Promise<User> {
		const connection = await this.getConnection();

		try {
			const user = await this.getUserByEmail(email);

			if (!user || !(await argon2.verify(user.password!, password))) {
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
			this.setCloseConnectionTimeout();
		}
	}

	async getUserByEmail(email: string): Promise<User> {
		const connection = await this.getConnection();

		try {
			const userResult = (await this.query<mysql.RowDataPacket[]>(
				connection,
				`SELECT * FROM user WHERE email=?`,
				[email]
			)) as User[];

			const user = userResult[0];

			return user;
		} finally {
			this.setCloseConnectionTimeout();
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
				const hashedPassword = await argon2.hash(password);

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
			this.setCloseConnectionTimeout();
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
			this.setCloseConnectionTimeout();
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
			this.setCloseConnectionTimeout();
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
			this.setCloseConnectionTimeout();
		}
	}

	async getActiveUsersCount(): Promise<number> {
		const connection = await this.getConnection();

		try {
			const result = await this.query<mysql.RowDataPacket[]>(
				connection,
				`SELECT COUNT(DISTINCT userId) as count FROM auth`,
				[]
			);

			return result[0]?.count || 0;
		} finally {
			this.setCloseConnectionTimeout();
		}
	}

	async getOrders(
		user: User,
		page = 1
	): Promise<{
		dinerId: number;
		orders: OrderItem[];
		page: number;
	}> {
		const connection = await this.getConnection();

		try {
			const offset = this.getOffset(page, this.config.db.listPerPage);

			const orders = (await this.query<mysql.RowDataPacket[]>(
				connection,
				`SELECT id, franchiseId, storeId, date FROM dinerOrder WHERE dinerId=? LIMIT ${offset},${this.config.db.listPerPage}`,
				[user.id]
			)) as OrderItem[];

			for (const order of orders) {
				const items = (await this.query<mysql.RowDataPacket[]>(
					connection,
					`SELECT id, menuId, description, price FROM orderItem WHERE orderId=?`,
					[order.id]
				)) as MenuItem[];

				order.items = items;
			}

			return { dinerId: user.id!, orders, page };
		} finally {
			this.setCloseConnectionTimeout();
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
			this.setCloseConnectionTimeout();
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
			this.setCloseConnectionTimeout();
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
			this.setCloseConnectionTimeout();
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
			this.setCloseConnectionTimeout();
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
			this.setCloseConnectionTimeout();
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
			this.setCloseConnectionTimeout();
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
			this.setCloseConnectionTimeout();
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
			this.setCloseConnectionTimeout();
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

	async addAdminUser() {
		await this.initialized;

		const roles: UserRole[] = [
			{
				role: Role.Admin,
				objectId: 1,
			},
		];

		const adminUser: User = {
			name: "常用名字",
			roles,
			email: "a@jwt.com",
			password: "admin",
		};

		try {
			await this.addUser(adminUser);
		} catch (error: unknown) {
			if ((error as StatusCodeError).statusCode === 409) {
				// user already exists
			} else {
				throw error;
			}
		}
	}

	async getConnection() {
		this.clearConnectionTimeout();
		await this.initialized;

		return this.connection ?? (await this._getConnection());
	}

	async _getConnection(setUse = true) {
		const connection = await mysql.createConnection({
			host: this.config.db.connection.host,
			user: this.config.db.connection.user,
			password: this.config.db.connection.password,
			connectTimeout: this.config.db.connection.connectTimeout,
			decimalNumbers: true,
		});

		this.connection = connection;

		if (setUse) {
			await this.useDatabase(connection);
		}

		return connection;
	}

	async initializeDatabase() {
		try {
			const connection =
				this.connection ?? (await this._getConnection(false));

			const createDatabaseStatement = `CREATE DATABASE IF NOT EXISTS ${this.config.db.connection.database}`;

			await connection.query(createDatabaseStatement);

			await this.useDatabase(connection);

			await Promise.all(
				dbModel.tableCreateStatements.map((statement) =>
					connection.query(statement)
				)
			);

			return true;
		} catch (err) {
			// TODO if (!(err instanceof Error)) return;
			console.error(
				JSON.stringify({
					message: "Error initializing database",

					// @ts-expect-error TS(2571): Object is of type 'unknown'.
					exception: err.message,
					connection: this.config.db.connection,
				})
			);

			return false;
		} finally {
			this.setCloseConnectionTimeout();
		}
	}

	async useDatabase(connection: mysql.Connection) {
		const useDatabaseStatement = `USE ${this.config.db.connection.database}`;

		await connection.query(useDatabaseStatement);

		// console.log("Using database", this.config.db.connection.database);
	}

	async dropDatabase(connection: mysql.Connection, database: string) {
		await this.query(connection, `DROP DATABASE IF EXISTS ${database}`);
	}

	setCloseConnectionTimeout() {
		this.clearConnectionTimeout();

		this.connectionTimeout = setTimeout(async () => {
			await this.endConnection();
		}, this.config.db.connection.connectTimeout);
	}

	async closeConnection() {
		this.clearConnectionTimeout();
		await this.endConnection();
	}

	clearConnectionTimeout() {
		if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
		this.connectionTimeout = null;
	}

	async endConnection() {
		// console.log("Ending connection");
		if (!this.connection || !(await this.isConnectionAlive())) return;
		await this.connection.end();
		this.connection = null;
	}

	async isConnectionAlive() {
		if (!this.connection) {
			return false;
		}

		try {
			await this.connection.ping();

			return true;
		} catch (error) {
			console.error(error);

			return false;
		}
	}
}

export { DB };
