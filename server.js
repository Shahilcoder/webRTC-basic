import fs from "fs";
import https from "https";
import express from "express";
import { Server as socketio } from "socket.io";

const app = express();
const PORT = process.env.PORT || 4001;

app.use(express.static("static"));

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

const commonPayloads = [];
const connectedSockets = [];

io.on("connection", socket => {
    console.log("Socket Connected");

    const userName = socket.handshake.auth.userName;
    const password = socket.handshake.auth.password;

    if (password != "password") {
        socket.disconnect(true);
        return;
    }

    connectedSockets.push({
        socketId: socket.id,
        userName
    });

    // new client has joined
    if (commonPayloads.length) {
        socket.emit('signaling:available-commonPayloads', commonPayloads);
    }

    socket.on('signaling:new-offer', newOffer => {
        commonPayloads.push({
            offererUserName: userName,
            offer: newOffer,
            offererIceCandidates: [],
            answererUserName: null,
            answer: null,
            answererIceCandidates: []
        });

        socket.broadcast.emit('signaling:new-offer-awaiting', commonPayloads.slice(-1));
    });

    socket.on("signaling:new-answer", (offerObj, ackFunction) => {
        const socketToAnswer = connectedSockets.find(s => s.userName === offerObj.offererUserName);
        if (!socketToAnswer) {
            console.log("No matching socket");
            return;
        }

        const socketIdToAnswer = socketToAnswer.socketId;

        const offerToUpdate = commonPayloads.find(o => o.offererUserName === offerObj.offererUserName);

        if (!offerToUpdate) {
            console.log("No offer to update");
            return;
        }

        ackFunction(offerToUpdate.offererIceCandidates);
        offerToUpdate.answer = offerObj.answer;
        offerToUpdate.answererUserName = userName;

        socket.to(socketIdToAnswer).emit('signaling:answer-response', offerToUpdate);
    });

    socket.on("signaling:send-ice-candidate", iceCandidateObj => {
        const { didIOffer, iceUserName, iceCandidate } = iceCandidateObj;

        if (didIOffer) {
            const offererOffer = commonPayloads.find(o => o.offererUserName === iceUserName);

            if (offererOffer) {
                offererOffer.offererIceCandidates.push(iceCandidate);

                if (offererOffer.answererUserName) {
                    const socketToSendTo = connectedSockets.find(s => s.userName === offererOffer.answererUserName);

                    if (socketToSendTo) {
                        socket.to(socketToSendTo.socketId).emit("signaling:responded-with-ice-candidate", iceCandidate);
                    } else {
                        console.log("received ice candidate but no answerer");
                    }
                }
            }
        } else {
            const answererOffer = commonPayloads.find(o => o.answererUserName === iceUserName);
            const socketToSendTo = connectedSockets.find(s => s.userName === answererOffer.offererUserName);

            if (socketToSendTo) {
                socket.to(socketToSendTo.socketId).emit("signaling:responded-with-ice-candidate", iceCandidate);
            } else {
                console.log("Ice candidate received but no offerer");
            }
        }
    });

    socket.on("hang-up", (closerUserName) => {
        const hangerObj = commonPayloads.find(c => c.offererUserName === closerUserName || c.answererUserName === closerUserName);

        if (!hangerObj) {
            console.log("No such peer connection found")
            return;
        }

        const userSocketIds = [
            connectedSockets.find(s => s.userName === hangerObj.offererUserName)?.socketId || "",
            connectedSockets.find(s => s.userName === hangerObj.answererUserName)?.socketId || ""
        ];

        socket.to(userSocketIds).emit("user-hang-up");
    })
});

httpsServer.listen(PORT, (error) => {
    if (error) {
        console.log(error);
        return;
    }

    console.log("Server listening at port:", PORT);
});
