import fs from "fs";
import https from "https";
import express from "express";
import { Server as socketio } from "socket.io";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.static("."));

const key = fs.readFileSync("cert.key");
const cert = fs.readFileSync("cert.crt");

const httpsServer = https.createServer({key, cert}, app);

const io = new socketio(httpsServer, {
    cors: {
        origin: [
            "https://localhost"
        ],
        methods: ["GET", "POST"]
    }
});

io.on("connection", socket => {
    console.log("Socket Connected");
});

httpsServer.listen(PORT, (error) => {
    if (error) {
        console.log(error);
        return;
    }

    console.log("Server listening at port:", PORT);
});
