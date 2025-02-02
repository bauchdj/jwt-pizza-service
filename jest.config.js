/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
	testEnvironment: "node",
	testPathIgnorePatterns: ["./dist/"],
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
