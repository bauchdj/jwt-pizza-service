import config from "./dbConfig.json";

export default {
	jwtSecret: config.jwtSecret,
	db: {
		connection: {
			host: config.db.connection.host,
			user: config.db.connection.user,
			password: config.db.connection.password,
			database: config.db.connection.database,
			connectTimeout: config.db.connection.connectTimeout,
		},
		listPerPage: config.db.listPerPage,
	},
	factory: {
		url: config.factory.url,
		apiKey: config.factory.apiKey,
	},
};
