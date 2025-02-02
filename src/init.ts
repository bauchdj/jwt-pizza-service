import { DB } from "./database/database.js";
import { Role, User } from "./model/model.js";

if (process.argv.length < 5) {
	console.log("Usage: node init.js <name> <email> <password>");
	process.exit(1);
}

const name = process.argv[2];
const email = process.argv[3];
const password = process.argv[4];
const user: User = {
	name,
	email,
	password,
	roles: [{ role: Role.Admin, objectId: 0 }],
};
DB.addUser(user).then((r: User) => console.log("created user: ", r));
