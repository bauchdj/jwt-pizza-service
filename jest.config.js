/** @type {import('jest').Config} */
const config = {
	testEnvironment: "node",
	testPathIgnorePatterns: ["./dist/"],
	// preset: "ts-jest",
	transform: {
		"^.+.tsx?$": ["ts-jest", {}],
	},
	collectCoverage: true,
	coverageReporters: ["json-summary", "text"],
	coverageThreshold: {
		global: {
			lines: 80,
		},
	},
};

export default config;
