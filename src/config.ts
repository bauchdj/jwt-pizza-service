import dbConfig from "./dbConfig.json";

type Config = {
	jwtSecret: string;
	db: {
		connection: {
			host: string;
			user: string;
			password: string;
			database: string;
			connectTimeout: number;
		};
		listPerPage: number;
	};
	factory: {
		url: string;
		apiKey: string;
	};
};

const jsonConfig = dbConfig as Config;

const config: Config = {
	jwtSecret: jsonConfig.jwtSecret,
	db: {
		connection: {
			host: jsonConfig.db.connection.host,
			user: jsonConfig.db.connection.user,
			password: jsonConfig.db.connection.password,
			database: jsonConfig.db.connection.database,
			connectTimeout: jsonConfig.db.connection.connectTimeout,
		},
		listPerPage: jsonConfig.db.listPerPage,
	},
	factory: {
		url: jsonConfig.factory.url,
		apiKey: jsonConfig.factory.apiKey,
	},
};

export default config;
