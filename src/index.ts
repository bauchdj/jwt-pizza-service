import app from "./service";

const port = process.argv[2] || 3000;

app.listen(port, () => {
	console.log(`Server started on port ${port}`);
});
