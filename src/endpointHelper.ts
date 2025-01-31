import { NextFunction, Request, RequestHandler, Response } from "express";

class StatusCodeError extends Error {
	statusCode: number;

	constructor(message: string, statusCode: number) {
		super(message);
		this.statusCode = statusCode;
	}
}

export function asyncHandler(fn: RequestHandler) {
	return (req: Request, res: Response, next: NextFunction) => {
		return Promise.resolve(fn(req, res, next)).catch(next);
	};
}

export { StatusCodeError };
