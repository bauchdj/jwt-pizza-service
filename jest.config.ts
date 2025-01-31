/** @jest-config-loader esbuild-register */

import type { Config } from "jest";

const config: Config = {
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
