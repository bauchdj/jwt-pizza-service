import config from "../src/config";
import { DB } from "../src/database/DB";
import createRandomString from "../src/utils/utils";

class DatabaseTestContext {
	database: DB | null = null;
	randomDatabase: string | null = null;
	test: (database: DB) => Promise<void>;

	constructor(
		dbConfig: typeof config,
		test: (database: DB) => Promise<void>
	) {
		this.test = test;
	}

	async before(): Promise<void> {
		const database = this.createDatabase();

		// REQURIED!!!
		// this makes sure that the database is initialization happens preventing the connection to finish before the tests do...
		await database.waitTillInitialized();

		// TestFn that gets passed to it() provided by jest
		await this.test(database);
	}

	public createDatabase() {
		const randomDatabase = createRandomString(10).toLowerCase();

		this.randomDatabase = randomDatabase;

		const dbConfig = { ...config };

		dbConfig.db.connection.database = randomDatabase;

		const database = new DB(dbConfig);

		this.database = database;

		return database;
	}

	async catch(error: unknown) {
		console.error(error);
	}

	async finally() {
		if (!this.database || !this.randomDatabase) {
			console.error(new Error("Database or random database is not set"));

			return;
		}

		const connection = await this.database.getConnection();

		await this.database.dropDatabase(connection, this.randomDatabase);

		await this.database.closeConnection();
	}
}

export default DatabaseTestContext;
