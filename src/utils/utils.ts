export default function createRandomString(length: number): string {
	let result = "";

	const characters =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

	const charactersLength = characters.length;

	for (let i = 0; i < length; i++) {
		result += characters.charAt(
			Math.floor(Math.random() * charactersLength)
		);
	}

	return result;
}

export function generateRandomDatabaseName(): string {
	const length = 20;
	const characters = "abcdefghijklmnopqrstuvwxyz0123456789";
	let result = "";

	// First character is a letter, one of the first 26
	result += characters.charAt(Math.floor(Math.random() * 26));

	// Generate the rest of the name
	for (let i = 1; i < length; i++) {
		result += characters.charAt(
			Math.floor(Math.random() * characters.length)
		);
	}

	return result;
}
