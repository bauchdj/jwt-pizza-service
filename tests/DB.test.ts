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
import createRandomString from "../src/utils/utils";
import DatabaseTestContext from "./DatabaseTestContext";

// jest.setTimeout(config.db.connection.connectTimeout);

describe("Database Tests", () => {
	describe("Connection Tests", () => {
		jestIt("creates database, connects, closes connection", async () => {
			await createDatabaseBeforeThenCheckIfConnectionIsClosedAfter(
				async (database) => {
					await database.closeConnection();
				}
			);
		});

		jestIt("closes connection AFTER  20 timeout", async () => {
			await testCloseConnectionAfterTimeout(20);
		});

		jestIt("closes connection AFTER  100 timeout", async () => {
			await testCloseConnectionAfterTimeout(100);
		});

		jestIt("closes connection AFTER  250 timeout", async () => {
			await testCloseConnectionAfterTimeout(250);
		});

		async function testCloseConnectionAfterTimeout(timeout: number) {
			await createDatabaseBeforeThenCheckIfConnectionIsClosedAfter(
				async () => {
					await new Promise((resolve) => {
						// + 10 or the tests will fail
						return setTimeout(resolve, timeout + 10);
					});
				},
				timeout
			);
		}

		async function createDatabaseBeforeThenCheckIfConnectionIsClosedAfter(
			closeConnection: (database: DB) => Promise<void>,
			timeout?: number
		) {
			const database = await createConnectionTestDatabase(timeout);
			const spy = jest.spyOn(database, "endConnection");

			expect(spy).not.toHaveBeenCalled();
			await closeConnection(database);
			expect(spy).toHaveBeenCalled();
			await testIfConnectionIsClosed(database);
		}

		async function createConnectionTestDatabase(timeout?: number) {
			const databaseTestContext = new DatabaseTestContext(
				config,
				timeout
			);

			const database = databaseTestContext.createDatabase();
			const databaseConnection = await database.getConnection();
			const databaseIsActive = await database.isConnectionAlive();

			expect(database).toBeDefined();
			expect(databaseConnection).toBeDefined();
			expect(databaseIsActive).toBe(true);

			return database;
		}

		async function testIfConnectionIsClosed(database: DB) {
			const databaseIsActive = await database.isConnectionAlive();

			expect(databaseIsActive).toBe(false);
			await database.closeConnection();
		}
	});

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
			const { dbUser, user } = await addTestUser(database, Role.Diner);

			expect(dbUser.roles).toBe(user.roles);
		});

		void it("should fail to get user by email and password", async (database) => {
			const user = createUserObject(Role.Diner);

			await expect(
				async () => await database.getUser(user.email, user.password!)
			).rejects.toThrow();
		});

		void it("should get user by email and password", async (database) => {
			const { user } = await addTestUser(database, Role.Diner);
			const dbUser = await database.getUser(user.email, user.password!);

			expect(dbUser.roles[0].role).toBe(user.roles[0].role);
			expect(dbUser.roles[0].objectId).toBe(user.roles[0].objectId);
		});

		void it("should update user", async (database) => {
			const { dbUser, user } = await addTestUser(database, Role.Diner);

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
			const { user } = await addTestUser(database, Role.Diner);
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
		void it("should get franchises empty array", async (database) => {
			const { user } = await addTestUser(database, Role.Admin);
			const franchises = await database.getFranchises(user);

			expect(franchises).toBeDefined();
			expect(Array.isArray(franchises)).toBe(true); // Check that items is an array
		});

		void it("should create franchise", async (database) => {
			const { dbFranchise, franchise } =
				await createTestFranchiseAndStore(database, Role.Diner);

			expect(dbFranchise).toBeDefined();
			expect(dbFranchise.name).toBe(franchise.name);
			expect(dbFranchise.admins[0]).toBe(franchise.admins[0]);
			expect(dbFranchise.stores).toBe(franchise.stores);
		});

		void it("should fail to create franchise", async (database) => {
			const dinerUser = createUserObject(Role.Diner);

			const franchise: Franchise = createFranciseInstanceFromUserArray([
				dinerUser,
			]);

			await expect(
				async () => await database.createFranchise(franchise)
			).rejects.toThrow();
		});

		void it("should get franchise after creation with franchise admin a diner user", async (database) => {
			await createFranchiseAndStoreThenGetFranchise(database, Role.Diner);
		});

		void it("should get franchise after creation with franchise admin a admin user", async (database) => {
			await createFranchiseAndStoreThenGetFranchise(database, Role.Admin);
		});

		void it("should get franchise by user id", async (database) => {
			// invalid user id
			const id = -1;
			const franchisesEmpty = await database.getUserFranchises(id);

			expect(franchisesEmpty).toBeDefined();
			expect(franchisesEmpty.length).toBe(0);

			const { dbUser, dbFranchise } = await createTestFranchiseAndStore(
				database,
				Role.Franchisee
			);

			const franchises = await database.getUserFranchises(dbUser.id!);

			expect(franchises).toBeDefined();
			expect(franchises.length).toBe(1);
			expect(franchises[0].name).toBe(dbFranchise.name);
		});

		void it("should delete franchise", async (database) => {
			const { dbUser, dbFranchise } = await createTestFranchiseAndStore(
				database,
				Role.Diner
			);

			await database.deleteFranchise(dbFranchise.id!);

			const franchises = await database.getFranchises(dbUser);

			expect(franchises).toBeDefined();
			expect(franchises.length).toBe(0);
		});

		void it("should delete store on franchise", async (database) => {
			const { dbFranchise, dbStore } = await createTestFranchiseAndStore(
				database,
				Role.Diner
			);

			await database.deleteStore(dbFranchise.id!, dbStore.id!);

			const franchise = await database.getFranchise(dbFranchise);
			const stores = franchise.stores;

			expect(stores).toBeDefined();
			expect(stores.length).toBe(0);
		});

		async function createFranchiseAndStoreThenGetFranchise(
			database: DB,
			role: RoleValueType
		) {
			const { dbUser, dbFranchise, dbStore } =
				await createTestFranchiseAndStore(database, role);

			const franchises = await database.getFranchises(dbUser);
			const stores = franchises[0].stores;

			expect(franchises).toBeDefined();
			expect(franchises.length).toBe(1);
			expect(franchises[0].name).toBe(dbFranchise.name);
			expect(stores).toBeDefined();
			expect(stores.length).toBe(1);
			expect(stores[0].name).toBe(dbStore.name);
		}
	});

	describe("Order Operations", () => {
		void it("should add diner order", async (database) => {
			const { dbDinerOrder, dinerOrder, orderItem } =
				await addTestDinerOrder(database);

			expect(dbDinerOrder).toBeDefined();
			expect(dbDinerOrder.id).toBeDefined();
			expect(dbDinerOrder.dinerId).toBe(dinerOrder.dinerId);
			expect(dbDinerOrder.franchiseId).toBe(dinerOrder.franchiseId);
			expect(dbDinerOrder.storeId).toBe(dinerOrder.storeId);
			expect(dbDinerOrder.items[0]).toBe(orderItem);
		});

		void it("should get orders", async (database) => {
			const { dinerOrder, dbUser } = await addTestDinerOrder(database);
			const orders = await database.getOrders(dbUser);

			expect(orders).toBeDefined();
			expect(orders.dinerId).toBe(dbUser.id!);
			expect(orders.orders).toBeDefined();
			expect(orders.orders.length).toBe(1);

			const ordersItem = orders.orders[0].items![0];

			expect(ordersItem).toBeDefined();
			expect(ordersItem.menuId).toBeDefined();
			expect(ordersItem.menuId!).toBe(dinerOrder.items[0].menuId);
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

function createUserObject(role: RoleValueType) {
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

async function createTestFranchiseAndStore(database: DB, role: RoleValueType) {
	const { dbUser } = await addTestUser(database, role);
	const { dbUser: dbAdminUser } = await addTestUser(database, Role.Admin);

	const { dbUser: dbFranchiseUser } = await addTestUser(
		database,
		Role.Franchisee
	);

	const franchise: Franchise = createFranciseInstanceFromUserArray([
		dbFranchiseUser,
	]);

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

function createFranciseInstanceFromUserArray(admins: User[]): Franchise {
	const name = `Test Franchise ${createRandomString(5)}`;

	return {
		name,
		admins,
		stores: [],
	};
}

async function addTestDinerOrder(database: DB) {
	const { dbStore, dbFranchise, dbUser } = await createTestFranchiseAndStore(
		database,
		Role.Diner
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

	const dbDinerOrder = await database.addDinerOrder(dbUser, dinerOrder);

	return {
		dbUser,
		dbStore,
		dbFranchise,
		dbDinerOrder,
		dinerOrder,
		dbMenuItem,
		orderItem,
	};
}

async function addTestUser(database: DB, role: RoleValueType) {
	const user: User = createUserObject(role);
	const dbUser = await database.addUser(user);

	expect(dbUser).toHaveProperty("id");
	expect(dbUser.name).toBe(user.name);
	expect(dbUser.email).toBe(user.email);
	expect(dbUser.password).toBeUndefined();

	return { dbUser, user };
}

async function it(testName: string, test: (database: DB) => Promise<void>) {
	const testFn = withDatabaseTest(test);

	jestIt(testName, testFn);
}

function withDatabaseTest(test: (database: DB) => Promise<void>) {
	const databaseTestContext = new DatabaseTestContext(
		config,
		undefined,
		test
	);

	return async () => {
		try {
			await databaseTestContext.before();
		} catch (error) {
			await databaseTestContext.catch(error);
			throw error;
		} finally {
			await databaseTestContext.finally();
		}
	};
}
