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
	grafana: {
		source: config.metrics.source,
		url: config.metrics.url,
		userId: config.metrics.userId,
		apiKey: config.metrics.apiKey,
	},
	logging: {
		source: config.logging.source,
		url: config.logging.url,
		userId: config.logging.userId,
		apiKey: config.logging.apiKey,
	},
};
