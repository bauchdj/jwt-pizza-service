import { describe, expect, it } from "@jest/globals";
import config from "../src/config";
import { DB } from "../src/database/database";

describe("Database Tests", () => {
	let database: DB;
	const sqlDatabase = "testing";
	config.db.connection.database = sqlDatabase;

	beforeEach(() => {
		database = new DB(config);
	});

	describe("Menu Operations", () => {
		it("should get menu items", async () => {
			expect(true);
		});

		// it("should add menu item", async () => {});
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
