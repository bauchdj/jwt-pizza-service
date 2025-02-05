import config from "../src/config";
import { DB } from "../src/database/DB";
import createRandomString from "../src/utils/utils";

class DatabaseTestContext {
	private config: typeof config;
	private closeConnectionTimeout: number;
	private test?: (database: DB) => Promise<void>;

	private database: DB | null = null;
	private randomDatabase: string | null = null;

	constructor(
		dbConfig: typeof config,
		closeConnectionTimeout?: number,
		test?: (database: DB) => Promise<void>
	) {
		const connectTimeout = dbConfig.db.connection.connectTimeout;

		this.config = dbConfig;
		this.closeConnectionTimeout = closeConnectionTimeout ?? connectTimeout;
		this.test = test;
	}

	public async before(): Promise<void> {
		const database = this.createDatabase();

		// REQURIED!!!
		// this makes sure that the database is initialization happens preventing the connection to finish before the tests do...
		await database.waitTillInitialized();

		// TestFn that gets passed to it() provided by jest
		if (this.test) await this.test(database);
	}

	public createDatabase() {
		const randomDatabase = createRandomString(10).toLowerCase();

		this.randomDatabase = randomDatabase;

		const dbConfig = { ...config };

		dbConfig.db.connection.database = randomDatabase;
		dbConfig.db.connection.connectTimeout = this.closeConnectionTimeout;

		const database = new DB(dbConfig);

		this.database = database;

		return database;
	}

	public async catch(error: unknown) {
		console.error(error);
	}

	public async finally() {
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
