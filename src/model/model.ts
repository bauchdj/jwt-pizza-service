const Role = {
	Diner: "diner",
	Franchisee: "franchisee",
	Admin: "admin",
} as const;

type RoleValueType = (typeof Role)[keyof typeof Role];

interface User {
	id?: number;
	name: string;
	email: string;
	password?: string;
	roles: UserRole[];
}

interface UserRole {
	id?: number;
	userId?: number;
	role: RoleValueType;
	objectId: number;
}

interface MenuItem {
	id?: number;
	title: string;
	image: string;
	price: number;
	description: string;
}

interface Franchise {
	id?: number;
	name: string;
	admins: FranchiseAdmin[];
	stores: Store[];
}

interface FranchiseAdmin {
	id?: number;
	name: string;
	email: string;
}

interface Store {
	id: number;
	franchiseId: number;
	name: string;
}

interface DinerOrder {
	id?: number;
	dinerId: number;
	franchiseId: number;
	storeId: number;
	date?: Date; // Optional if not always needed
	items: OrderItem[];
}

interface OrderItem {
	id?: number;
	orderId: number;
	menuId: number;
	description: string;
	price: number;
}

export {
	DinerOrder,
	Franchise,
	FranchiseAdmin,
	MenuItem,
	OrderItem,
	Role,
	RoleValueType,
	Store,
	User,
	UserRole,
};
