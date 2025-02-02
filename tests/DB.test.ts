import { describe, expect, jest, it as jestIt } from "@jest/globals";
import config from "../src/config";
import { DB } from "../src/database/DB";

jest.setTimeout(config.db.connection.connectTimeout);

async function withDatabaseTest(test: (database: DB) => Promise<void>) {
	const randomDatabase = createRandomString(10).toLowerCase();
	const dbConfig = { ...config };
	dbConfig.db.connection.database = randomDatabase;
	const database = new DB(dbConfig);
	const connection = await database.getConnection();

	return async () => {
		try {
			await test(database);
		} catch (error) {
			console.error(error);
		} finally {
			await database.dropDatabase(connection, randomDatabase);
			console.log("Done");
		}
	};
}

async function it(testName: string, test: (database: DB) => Promise<void>) {
	const withDatabaseTest = (test: (database: DB) => Promise<void>) => {
		interface DatabaseContext {
			database: DB | null;
			randomDatabase: string | null;
			try(): Promise<void>;
			catch(error: unknown): void;
			finally(): Promise<void>;
		}

		const databaseContext: DatabaseContext = {
			database: null,
			randomDatabase: null,
			async try(): Promise<void> {
				const randomDatabase = createRandomString(10).toLowerCase();
				this.randomDatabase = randomDatabase;
				const dbConfig = { ...config };
				dbConfig.db.connection.database = randomDatabase;
				const database = new DB(dbConfig);
				this.database = database;
				// TestFn that gets passed to it() provided by jest
				await test(database);
			},
			catch(error) {
				console.error(error);
			},
			async finally() {
				if (!this.database || !this.randomDatabase) return;

				const connection = await this.database.getConnection();
				await this.database.dropDatabase(
					connection,
					this.randomDatabase
				);
				await this.database.closeConnection();
				console.log("Done");
			},
		};

		return async () => {
			console.log("Running test: ", testName);
			try {
				databaseContext.try();
			} catch (error) {
				databaseContext.catch(error);
			} finally {
				databaseContext.finally();
			}
		};
	};

	const testFn = withDatabaseTest(test);
	jestIt(testName, testFn);
}

describe("Database Tests", () => {
	describe("Menu Operations", () => {
		it("should get menu items", async (database) => {
			const items = await database.getMenu();
			expect(items).toBeDefined(); // Check that items are defined
			expect(Array.isArray(items)).toBe(true); // Check that items is an array
		});

		// it("should add menu item", async (database) => {
		// jestIt(
		// 	"should get menu items",
		// 	async () =>
		// 		await withDatabaseTest(async (database) => {
		// 			const items = await database.getMenu();
		// 			expect(items).toBeDefined(); // Check that items are defined
		// 			expect(Array.isArray(items)).toBe(true); // Check that items is an array
		// 		})
		// );

		// 	const newItem: MenuItem = {
		// 		title: "Pizza",
		// 		description: "Delicious",
		// 		image: "url",
		// 		price: 10,
		// 	};
		// 	const addedItem = await database.addMenuItem(newItem); // Call the actual method
		// 	expect(addedItem).toHaveProperty("id"); // Check that the added item has an id
		// 	expect(addedItem.title).toBe(newItem.title); // Check that the title matches
		// 	expect(addedItem.description).toBe(newItem.description); // Check that the description matches
		// 	expect(addedItem.image).toBe(newItem.image); // Check that the image matches
		// 	expect(addedItem.price).toBe(newItem.price); // Check that the price matches
	});

	// describe("User Operations", () => {
	// 	it("should add user", async () => {});

	// 	it("should get user by email and password", async () => {});
	// });

	// describe("Franchise Operations", () => {
	// 	it("should get franchises", async () => {});

	// 	it("should create franchise", async () => {});
	// });

	// describe("Order Operations", () => {
	// 	it("should add diner order", async () => {});
	// });
});

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
