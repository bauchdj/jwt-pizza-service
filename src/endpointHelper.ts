class StatusCodeError extends Error {
// @ts-expect-error TS(7006): Parameter 'message' implicitly has an 'any' type.
	constructor(message, statusCode) {
		super(message);
// @ts-expect-error TS(2339): Property 'statusCode' does not exist on type 'Stat... Remove this comment to see the full error message
		this.statusCode = statusCode;
	}
}

// @ts-expect-error TS(7006): Parameter 'fn' implicitly has an 'any' type.
const asyncHandler = (fn) => (req, res, next) => {
	return Promise.resolve(fn(req, res, next)).catch(next);
};

export { asyncHandler, StatusCodeError };
