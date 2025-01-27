import bcrypt from "bcrypt";
import mysql from "mysql2/promise";
import config from "../config.js";
import { StatusCodeError } from "../endpointHelper.js";
import { Role } from "../model/model.js";
import { Item, tableCreateStatements } from "./dbModel.js";

class DB {
	initialized;

	constructor() {
		this.initialized = this.initializeDatabase();
	}

	async getMenu() {
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

	async addMenuItem(item: Item) {
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

	// @ts-expect-error TS(7006): Parameter 'user' implicitly has an 'any' type.
	async addUser(user) {
		const connection = await this.getConnection();
		try {
			const hashedPassword = await bcrypt.hash(user.password, 10);

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
							role.object,
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

	// @ts-expect-error TS(7006): Parameter 'email' implicitly has an 'any' type.
	async getUser(email, password) {
		const connection = await this.getConnection();
		try {
			const userResult = await this.query<mysql.RowDataPacket[]>(
				connection,
				`SELECT * FROM user WHERE email=?`,
				[email]
			);
			const user = userResult[0];
			if (!user || !(await bcrypt.compare(password, user.password))) {
				throw new StatusCodeError("unknown user", 404);
			}

			const roleResult = await this.query(
				connection,
				`SELECT * FROM userRole WHERE userId=?`,
				[user.id]
			);
			// @ts-expect-error TS(7006): Parameter 'r' implicitly has an 'any' type.
			const roles = roleResult.map((r) => {
				return { objectId: r.objectId || undefined, role: r.role };
			});

			return { ...user, roles: roles, password: undefined };
		} finally {
			connection.end();
		}
	}

	// @ts-expect-error TS(7006): Parameter 'userId' implicitly has an 'any' type.
	async updateUser(userId, email, password) {
		const connection = await this.getConnection();
		try {
			const params = [];
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
				// @ts-expect-error TS(2554): Expected 3 arguments, but got 2.
				await this.query(connection, query);
			}
			return this.getUser(email, password);
		} finally {
			connection.end();
		}
	}

	// @ts-expect-error TS(7006): Parameter 'userId' implicitly has an 'any' type.
	async loginUser(userId, token) {
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

	// @ts-expect-error TS(7006): Parameter 'token' implicitly has an 'any' type.
	async isLoggedIn(token) {
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

	// @ts-expect-error TS(7006): Parameter 'token' implicitly has an 'any' type.
	async logoutUser(token) {
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

	// @ts-expect-error TS(7006): Parameter 'user' implicitly has an 'any' type.
	async getOrders(user, page = 1) {
		const connection = await this.getConnection();
		try {
			const offset = this.getOffset(page, config.db.listPerPage);
			const orders = await this.query<mysql.RowDataPacket[]>(
				connection,
				`SELECT id, franchiseId, storeId, date FROM dinerOrder WHERE dinerId=? LIMIT ${offset},${config.db.listPerPage}`,
				[user.id]
			);
			for (const order of orders) {
				let items = await this.query(
					connection,
					`SELECT id, menuId, description, price FROM orderItem WHERE orderId=?`,
					[order.id]
				);
				order.items = items;
			}
			return { dinerId: user.id, orders: orders, page };
		} finally {
			connection.end();
		}
	}

	// @ts-expect-error TS(7006): Parameter 'user' implicitly has an 'any' type.
	async addDinerOrder(user, order) {
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

	// @ts-expect-error TS(7006): Parameter 'franchise' implicitly has an 'any' type... Remove this comment to see the full error message
	async createFranchise(franchise) {
		const connection = await this.getConnection();
		try {
			for (const admin of franchise.admins) {
				const adminUser = await this.query<mysql.RowDataPacket[]>(
					connection,
					`SELECT id, name FROM user WHERE email=?`,
					[admin.email]
				);
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

	// @ts-expect-error TS(7006): Parameter 'franchiseId' implicitly has an 'any' ty... Remove this comment to see the full error message
	async deleteFranchise(franchiseId) {
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

	// @ts-expect-error TS(7006): Parameter 'authUser' implicitly has an 'any' type.
	async getFranchises(authUser) {
		const connection = await this.getConnection();
		try {
			const franchises = await this.query<mysql.RowDataPacket[]>(
				connection,
				`SELECT id, name FROM franchise`,
				undefined
			);
			for (const franchise of franchises) {
				if (authUser?.isRole(Role.Admin)) {
					await this.getFranchise(franchise);
				} else {
					franchise.stores = await this.query(
						connection,
						`SELECT id, name FROM store WHERE franchiseId=?`,
						[franchise.id]
					);
				}
			}
			return franchises;
		} finally {
			connection.end();
		}
	}

	// @ts-expect-error TS(7006): Parameter 'userId' implicitly has an 'any' type.
	async getUserFranchises(userId) {
		const connection = await this.getConnection();
		try {
			let franchiseIds = await this.query<mysql.RowDataPacket[]>(
				connection,
				`SELECT objectId FROM userRole WHERE role='franchisee' AND userId=?`,
				[userId]
			);
			if (franchiseIds.length === 0) {
				return [];
			}

			franchiseIds = franchiseIds.map((v) => v.objectId);
			const franchises = await this.query<mysql.RowDataPacket[]>(
				connection,
				`SELECT id, name FROM franchise WHERE id in (${franchiseIds.join(
					","
				)})`,
				undefined
			);
			for (const franchise of franchises) {
				await this.getFranchise(franchise);
			}
			return franchises;
		} finally {
			connection.end();
		}
	}

	// @ts-expect-error TS(7006): Parameter 'franchise' implicitly has an 'any' type... Remove this comment to see the full error message
	async getFranchise(franchise) {
		const connection = await this.getConnection();
		try {
			franchise.admins = await this.query(
				connection,
				`SELECT u.id, u.name, u.email FROM userRole AS ur JOIN user AS u ON u.id=ur.userId WHERE ur.objectId=? AND ur.role='franchisee'`,
				[franchise.id]
			);

			franchise.stores = await this.query(
				connection,
				`SELECT s.id, s.name, COALESCE(SUM(oi.price), 0) AS totalRevenue FROM dinerOrder AS do JOIN orderItem AS oi ON do.id=oi.orderId RIGHT JOIN store AS s ON s.id=do.storeId WHERE s.franchiseId=? GROUP BY s.id`,
				[franchise.id]
			);

			return franchise;
		} finally {
			connection.end();
		}
	}

	// @ts-expect-error TS(7006): Parameter 'franchiseId' implicitly has an 'any' ty... Remove this comment to see the full error message
	async createStore(franchiseId, store) {
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

	// @ts-expect-error TS(7006): Parameter 'franchiseId' implicitly has an 'any' ty... Remove this comment to see the full error message
	async deleteStore(franchiseId, storeId) {
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

	// @ts-expect-error TS(7006): Parameter 'listPerPage' implicitly has an 'any' ty... Remove this comment to see the full error message
	getOffset(currentPage = 1, listPerPage) {
		// @ts-expect-error TS(2363): The right-hand side of an arithmetic operation mus... Remove this comment to see the full error message
		return (currentPage - 1) * [listPerPage];
	}

	// @ts-expect-error TS(7006): Parameter 'token' implicitly has an 'any' type.
	getTokenSignature(token) {
		const parts = token.split(".");
		if (parts.length > 2) {
			return parts[2];
		}
		return "";
	}

	async query<T extends mysql.QueryResult>(
		connection: mysql.Connection,
		sql: string,
		params: any[] | undefined
	) {
		const [results] = await connection.execute<T>(sql, params);
		return results;
	}

	async getID(
		connection: mysql.Connection,
		key: string,
		value: string,
		table: string
	) {
		const [rows] = await connection.execute<mysql.RowDataPacket[]>(
			`SELECT id FROM ${table} WHERE ${key}=?`,
			[value]
		);
		if (rows.length > 0) {
			return rows[0].id;
		}
		throw new Error("No ID found");
	}

	async getConnection() {
		// Make sure the database is initialized before trying to get a connection.
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

				for (const statement of tableCreateStatements) {
					await connection.query(statement);
				}

				if (!dbExists) {
					const defaultAdmin = {
						name: "常用名字",
						email: "a@jwt.com",
						password: "admin",
						roles: [{ role: Role.Admin }],
					};
					this.addUser(defaultAdmin);
				}
			} finally {
				connection.end();
			}
		} catch (err) {
			// if (!(err instanceof Error)) return;
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
export { db as DB, Role };
