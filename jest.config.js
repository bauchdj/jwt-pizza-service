/** @type {import('jest').Config} */
const config = {
	preset: "ts-jest",
	testEnvironment: "node",
	testPathIgnorePatterns: ["./dist/"],
	collectCoverage: true,
	coverageReporters: ["json-summary", "text"],
	coverageThreshold: {
		global: {
			lines: 80,
		},
	},
};

export default config;
