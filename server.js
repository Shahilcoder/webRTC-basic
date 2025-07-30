import express from "express";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.static("."));

app.listen(PORT, (error) => {
    if (error) {
        console.log(error);
        return;
    }

    console.log("Server listening at port:", PORT);
});
