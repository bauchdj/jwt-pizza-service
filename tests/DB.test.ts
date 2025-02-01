import { describe, expect, it } from "@jest/globals";
import config from "../src/config";
import { DB } from "../src/database/DB";

describe("Database Tests", () => {
	let database: DB;
	let testDatabases: string[] = [];

	beforeEach(async () => {
		// Set up a new database connection and create testing database for each test
		const randomString = createRandomString(10).toLowerCase();
		testDatabases.push(randomString);
		const dbConfig = { ...config };
		dbConfig.db.connection.database = randomString;
		database = new DB(dbConfig);
		await database.initialized;
		console.log(database.initialized);
	});

	afterAll(async () => {
		// Clean up the database after each test
		const connection = await database.getConnection();
		console.log({ testDatabases });
		Promise.all(
			testDatabases.map((databaseString) => {
				database.query(
					connection,
					`DROP DATABASE IF EXISTS ${databaseString}`
				);
			})
		);
	});

	describe("Menu Operations", () => {
		it("should get menu items", async () => {
			console.log("getting menu");
			const items = await database.getMenu(); // Call the actual method
			expect(items).toBeDefined(); // Check that items are defined
			expect(Array.isArray(items)).toBe(true); // Check that items is an array
		});

		// it("should add menu item", async () => {
		// 	const newItem = {
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
		// });
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
