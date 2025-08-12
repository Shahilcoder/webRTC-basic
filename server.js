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

const offers = [];
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
    if (offers.length) {
        socket.emit('availableOffers', offers);
    }

    socket.on('newOffer', newOffer => {
        offers.push({
            offererUserName: userName,
            offer: newOffer,
            offerIceCandidates: [],
            answererUserName: null,
            answer: null,
            answererIceCandidates: []
        });

        socket.broadcast.emit('newOfferAwaiting', offers.slice(-1));
    });

    socket.on("newAnswer", (offerObj, ackFunction) => {
        console.log(offerObj);

        const socketToAnswer = connectedSockets.find(s => s.userName === offerObj.offererUserName);
        if (!socketToAnswer) {
            console.log("No matching socket");
            return;
        }

        const socketIdToAnswer = socketToAnswer.socketId;

        const offerToUpdate = offers.find(o => o.offererUserName === offerObj.offererUserName);

        if (!offerToUpdate) {
            console.log("No offer to update");
            return;
        }

        ackFunction(offerToUpdate.offerIceCandidates);
        offerToUpdate.answer = offerObj.answer;
        offerToUpdate.answererUserName = userName;

        socket.to(socketIdToAnswer).emit('answerResponse', offerToUpdate);
    });

    socket.on("sendIceCandidateToSignalingServer", iceCandidateObj => {
        const { didIOffer, iceUserName, iceCandidate } = iceCandidateObj;

        if (didIOffer) {
            const offererOffer = offers.find(o => o.offererUserName === iceUserName);

            if (offererOffer) {
                offererOffer.offerIceCandidates.push(iceCandidate);

                if (offererOffer.answererUserName) {
                    const socketToSendTo = connectedSockets.find(s => s.userName === offererOffer.answererUserName);

                    if (socketToSendTo) {
                        socket.to(socketToSendTo.socketId).emit("receivedIceCandidateFromServer", iceCandidate);
                    } else {
                        console.log("received ice candidate but no answerer");
                    }
                }
            }
        } else {
            const answererOffer = offers.find(o => o.answererUserName === iceUserName);
            const socketToSendTo = connectedSockets.find(s => s.userName === answererOffer.offererUserName);

            if (socketToSendTo) {
                socket.to(socketToSendTo.socketId).emit("receivedIceCandidateFromServer", iceCandidate);
            } else {
                console.log("Ice candidate received but no offerer");
            }
        }
    });
});

httpsServer.listen(PORT, (error) => {
    if (error) {
        console.log(error);
        return;
    }

    console.log("Server listening at port:", PORT);
});
