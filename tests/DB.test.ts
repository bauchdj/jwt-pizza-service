import { describe, expect, jest, it as jestIt } from "@jest/globals";
import jwt from "jsonwebtoken";
import config from "../src/config";
import { DB } from "../src/database/DB";
import {
	DinerOrder,
	Franchise,
	MenuItem,
	OrderItem,
	Role,
	RoleValueType,
	Store,
	User,
	UserRole,
} from "../src/model/model";

jest.setTimeout(config.db.connection.connectTimeout);

describe("Database Tests", () => {
	describe("Menu Operations", () => {
		void it("should get menu items", async (database) => {
			const items = await database.getMenu();

			expect(items).toBeDefined(); // Check that items are defined
			expect(Array.isArray(items)).toBe(true); // Check that items is an array
		});

		void it("should add menu item", async (database) => {
			const { dbMenuItem, menuItem } = await addTestMenuItem(database);

			expect(dbMenuItem).toHaveProperty("id"); // Check that the added item has an id
			expect(dbMenuItem.title).toBe(menuItem.title); // Check that the title matches
			expect(dbMenuItem.description).toBe(menuItem.description); // Check that the description matches
			expect(dbMenuItem.image).toBe(menuItem.image); // Check that the image matches
			expect(dbMenuItem.price).toBe(menuItem.price); // Check that the price matches
		});
	});

	describe("User Operations", () => {
		void it("should add user", async (database) => {
			const { dbUser, user } = await addTestUser(database);

			expect(dbUser.roles).toBe(user.roles);
		});

		void it("should fail to get user by email and password", async (database) => {
			const user = createUserObject();

			await expect(
				async () => await database.getUser(user.email, user.password!)
			).rejects.toThrow();
		});

		void it("should get user by email and password", async (database) => {
			const { user } = await addTestUser(database);
			const dbUser = await database.getUser(user.email, user.password!);

			expect(dbUser.roles[0].role).toBe(user.roles[0].role);
			expect(dbUser.roles[0].objectId).toBe(user.roles[0].objectId);
		});

		void it("should update user", async (database) => {
			const { dbUser, user } = await addTestUser(database);

			const updatedUser: User = {
				...user,
				email: "new email",
				password: "new password",
			};

			await database.updateUser(
				dbUser.id!,
				updatedUser.email,
				updatedUser.password
			);

			const dbUpdatedUser = await database.getUser(
				updatedUser.email,
				updatedUser.password!
			);

			expect(dbUpdatedUser.email).toBe(updatedUser.email);
			expect(dbUpdatedUser.password).toBeUndefined();
		});

		void it("should login user and logout user", async (database) => {
			const { user } = await addTestUser(database);
			const dbUser = await database.getUser(user.email, user.password!);
			const token = jwt.sign(user, config.jwtSecret);
			let isLoggedIn = await database.isLoggedIn(token);

			expect(isLoggedIn).toBe(false);
			await database.loginUser(dbUser.id!, token);
			isLoggedIn = await database.isLoggedIn(token);
			expect(isLoggedIn).toBe(true);
			await database.logoutUser(token);
			isLoggedIn = await database.isLoggedIn(token);
			expect(isLoggedIn).toBe(false);
		});
	});

	describe("Franchise Operations", () => {
		void it("should get franchises", async (database) => {
			const { user } = await addTestUser(database, Role.Admin);
			const franchises = await database.getFranchises(user);

			expect(franchises).toBeDefined();
			expect(Array.isArray(franchises)).toBe(true); // Check that items is an array
		});

		void it("should create franchise", async (database) => {
			const {
				dbFranchise,
				franchise,
			}: { dbFranchise: Franchise; franchise: Franchise } =
				await createTestFranchiseAndStore(database);

			expect(dbFranchise).toBeDefined();
			expect(dbFranchise.name).toBe(franchise.name);
			expect(dbFranchise.admins[0]).toBe(franchise.admins[0]);
			expect(dbFranchise.stores).toBe(franchise.stores);
		});
	});

	describe("Order Operations", () => {
		void it("should add diner order", async (database) => {
			const { order, dinerOrder, orderItem } = await addTestDinerOrder(
				database
			);

			expect(order).toBeDefined();
			expect(order.id).toBeDefined();
			expect(order.dinerId).toBe(dinerOrder.dinerId);
			expect(order.franchiseId).toBe(dinerOrder.franchiseId);
			expect(order.storeId).toBe(dinerOrder.storeId);
			expect(order.items[0]).toBe(orderItem);
		});
	});
});

async function addTestMenuItem(database: DB) {
	const menuItem: MenuItem = {
		title: "Pizza",
		description: "Delicious",
		image: "url",
		price: 10,
	};

	const dbMenuItem = await database.addMenuItem(menuItem);

	return { dbMenuItem, menuItem };
}

async function addTestUser(database: DB, role?: RoleValueType) {
	const user: User = createUserObject(role);
	const dbUser = await database.addUser(user);

	expect(dbUser).toHaveProperty("id");
	expect(dbUser.name).toBe(user.name);
	expect(dbUser.email).toBe(user.email);
	expect(dbUser.password).toBeUndefined();

	return { dbUser, user };
}

function createUserObject(role?: RoleValueType) {
	role = role ?? Role.Diner;

	const roles: UserRole[] = [
		{
			role,
			objectId: 0,
		},
	];

	const user: User = {
		name: "Test User",
		roles,
		email: "test",
		password: "test",
	};

	return user;
}

async function createTestFranchiseAndStore(database: DB) {
	const { dbUser } = await addTestUser(database, Role.Diner);
	const { dbUser: dbAdminUser } = await addTestUser(database, Role.Admin);

	const { dbUser: dbFranchiseUser } = await addTestUser(
		database,
		Role.Franchisee
	);

	const franchise: Franchise = {
		name: "Test Franchise",
		admins: [dbFranchiseUser],
		stores: [],
	};

	const dbFranchise = await database.createFranchise(franchise);

	const store: Store = {
		name: "Test Store",
		franchiseId: franchise.id!,
	};

	const dbStore = await database.createStore(franchise.id!, store);

	return {
		dbFranchise,
		franchise,
		dbStore,
		store,
		dbUser,
		dbAdminUser,
		dbFranchiseUser,
	};
}

async function addTestDinerOrder(database: DB) {
	const { dbStore, dbFranchise, dbUser } = await createTestFranchiseAndStore(
		database
	);

	const { dbMenuItem } = await addTestMenuItem(database);

	const orderItem: OrderItem = {
		menuId: dbMenuItem.id!,
		description: dbMenuItem.description,
		price: dbMenuItem.price,
	};

	const dinerOrder: DinerOrder = {
		dinerId: dbUser.id!,
		franchiseId: dbFranchise.id!,
		storeId: dbStore.id!,
		items: [orderItem],
	};

	const order = await database.addDinerOrder(dbUser, dinerOrder);

	return { order, dinerOrder, orderItem };
}

async function it(testName: string, test: (database: DB) => Promise<void>) {
	const withDatabaseTest = (test: (database: DB) => Promise<void>) => {
		class DatabaseContext {
			database: DB | null = null;
			randomDatabase: string | null = null;

			async try(): Promise<void> {
				const randomDatabase = createRandomString(10).toLowerCase();

				this.randomDatabase = randomDatabase;

				const dbConfig = { ...config };

				dbConfig.db.connection.database = randomDatabase;

				const database = new DB(dbConfig);

				this.database = database;

				// REQURIED!!!
				// this makes sure that the database is initialization happens preventing the connection to finish before the tests do...
				await database.initialized;

				// TestFn that gets passed to it() provided by jest
				await test(database);
			}

			async catch(error: unknown) {
				console.error(error);
			}

			async finally() {
				if (!this.database || !this.randomDatabase) {
					console.error(
						new Error("Database or random database is not set")
					);

					return;
				}

				const connection = await this.database.getConnection();

				await this.database.dropDatabase(
					connection,
					this.randomDatabase
				);

				await this.database.closeConnection();
			}
		}

		const databaseContext = new DatabaseContext();

		return async () => {
			try {
				await databaseContext.try();
			} catch (error) {
				await databaseContext.catch(error);
				throw error;
			} finally {
				await databaseContext.finally();
			}
		};
	};

	const testFn = withDatabaseTest(test);

	jestIt(testName, testFn);
}

function createRandomString(length: number): string {
	let result = "";

	const characters =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

	const charactersLength = characters.length;

	for (let i = 0; i < length; i++) {
		result += characters.charAt(
			Math.floor(Math.random() * charactersLength)
		);
	}

	return result;
}
