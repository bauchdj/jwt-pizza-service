import pluginJs from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

/** @type {import('eslint').Linter.Config[]} */
const config = [
	{
		ignores: ["node_modules", "dist", "coverage"],
	},
	{
		rules: {
			"@typescript-eslint/no-floating-promises": "error",
		},
	},
	{
		languageOptions: {
			parserOptions: {
				projectService: {
					allowDefaultProject: ["*.js", "tests/*"],
					defaultProject: "tsconfig.json",
				},
				tsconfigRootDir: import.meta.dirname,
			},
			globals: globals.browser,
		},
	},
	{ files: ["**/*.{js,mjs,cjs,ts}"] },
	pluginJs.configs.recommended,
	...tseslint.configs.recommended,
];

export default config;
