// @ts-expect-error TS(2307): Cannot find module '../database/database.js' or it... Remove this comment to see the full error message
import { DB, Role } from "../database/database.js";

if (process.argv.length < 5) {
	console.log("Usage: node init.js <name> <email> <password>");
	process.exit(1);
}

const name = process.argv[2];
const email = process.argv[3];
const password = process.argv[4];
const user = { name, email, password, roles: [{ role: Role.Admin }] };
// @ts-expect-error TS(7006): Parameter 'r' implicitly has an 'any' type.
DB.addUser(user).then((r) => console.log("created user: ", r));
