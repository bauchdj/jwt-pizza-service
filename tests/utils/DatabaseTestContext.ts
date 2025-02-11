import config from "../../src/config";
import { DB } from "../../src/database/DB";
import { generateRandomDatabaseName } from "../../src/utils/utils";

class DatabaseTestContext {
	private test?: (database: DB) => Promise<void>;
	private closeConnectionTimeout: number;

	private database: DB | null = null;
	private randomDatabase: string | null = null;

	constructor(
		test?: (database: DB) => Promise<void>,
		closeConnectionTimeout?: number
	) {
		const connectTimeout = config.db.connection.connectTimeout;

		this.closeConnectionTimeout = closeConnectionTimeout ?? connectTimeout;
		this.test = test;
	}

	public async before(): Promise<void> {
		const database = this.createDatabase();

		// TestFn that gets passed to it() provided by jest
		if (this.test) await this.test(database);
	}

	public createDatabase() {
		const randomDatabase = generateRandomDatabaseName();

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

function withDatabaseTest(test: (database: DB) => Promise<void>) {
	const databaseTestContext = new DatabaseTestContext(test);

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

export { DatabaseTestContext, withDatabaseTest };
