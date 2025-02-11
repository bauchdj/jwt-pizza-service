import pluginJs from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

/** @type {import('eslint').Linter.Config[]} */
const config = [
	{
		ignores: ["node_modules", "dist", "coverage"],
	},
	{
		plugins: {
			"@typescript-eslint": tseslint.plugin,
		},
	},
	{
		rules: {
			"@typescript-eslint/no-floating-promises": "error",
			"lines-around-comment": [
				"error",
				{
					beforeBlockComment: true,
					beforeLineComment: true,
					allowBlockStart: true,
					allowObjectStart: true,
					allowArrayStart: true,
					allowClassStart: true,
					afterHashbangComment: true,
				},
			],
			"lines-between-class-members": [
				"error",
				"always",
				{ exceptAfterSingleLine: true },
			],
			"padding-line-between-statements": [
				"error",
				{
					blankLine: "always",
					prev: "*",
					next: [
						"return",
						"export",
						"const",
						"let",
						"var",
						"function",
						"multiline-block-like",
						"directive",
						"multiline-expression",
						"multiline-const",
						"multiline-let",
						"multiline-var",
					],
				},
				{
					blankLine: "always",
					prev: [
						"const",
						"let",
						"var",
						"function",
						"multiline-block-like",
						"directive",
						"multiline-expression",
					],
					next: "*",
				},
				{
					blankLine: "any",
					prev: ["const", "let", "var"],
					next: ["const", "let", "var"],
				},
				{
					blankLine: "always",
					prev: "*",
					next: ["multiline-const", "multiline-let", "multiline-var"],
				},
				{
					blankLine: "always",
					prev: ["multiline-const", "multiline-let", "multiline-var"],
					next: "*",
				},
				{ blankLine: "any", prev: "directive", next: "directive" },
			],
		},
	},
	{
		languageOptions: {
			parserOptions: {
				projectService: {
					allowDefaultProject: [
						"*.js",
						"*.ts",
						"tests/utils/*",
						"tests/database/*",
					],
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
