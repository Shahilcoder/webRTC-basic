const userName = "User-" + Math.floor(Math.random() * 10000);
const password = "password";

document.querySelector("#user-name").innerText = userName;

const socket = io.connect("https://localhost:4001", {
    auth: {
        userName, password
    }
});

const localVideoEl = document.querySelector("#local-video");
const remoteVideoEl = document.querySelector("#remote-video");
const callButton = document.querySelector("#call");
const hangUpButton = document.querySelector("#hangup");
const answerEl = document.querySelector('#answer');

let localStream;
let remoteStream;
let peerConnection;
let didIOffer = false;

let peerConfig = {
    iceServers: [
        {
            urls: [
                "stun:stun.l.google.com:19302",
                "stun:stun1.l.google.com:19302"
            ]
        }
    ]
};

const fetchUserMedia = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: true
        });

        localVideoEl.srcObject = stream;
        localStream = stream;

        return true;
    } catch (error) {
        console.log(error);
        return false;
    }
};

const createPeerConnection = async (commonPayload) => {
    try {

        peerConnection = new RTCPeerConnection(peerConfig);
        remoteStream = new MediaStream();
        remoteVideoEl.srcObject = remoteStream;

        localStream.getTracks().forEach(track => {
            // video track, audio track etc.
            // Q: aren't you adding it extra? localStream already has it...
            // oh yes, and streams can be multiple here.
            peerConnection.addTrack(track, localStream);
        });

        peerConnection.addEventListener("signalingstatechange", (event) => {
            console.log("signaling state change", event);
            console.log(peerConnection.signalingState);
        });

        peerConnection.addEventListener("icecandidate", event => {
            console.log("Found ice candidate", event);

            if (event.candidate) {
                socket.emit('signaling:send-ice-candidate', {
                    iceCandidate: event.candidate,
                    iceUserName: userName,
                    didIOffer
                });
            }
        });

        peerConnection.addEventListener("track", event => {
            console.log("Got a track from the peer", event);
            // Hm.... streams can be multiple
            event.streams[0].getTracks().forEach(track => {
                remoteStream.addTrack(track);
            });
        });

        if (commonPayload) {
            await peerConnection.setRemoteDescription(commonPayload.offer);
        }

        return true;
    } catch (error) {
        console.log(error);
        return false;
    }
};

const call = async () => {
    const gotUserMedia = await fetchUserMedia();

    if (!gotUserMedia) return;

    const peerConnectionCreated = await createPeerConnection();

    if (!peerConnectionCreated) return;

    try {
        console.log("Creating offer...");
        const offer = await peerConnection.createOffer();
        console.log(offer);
        peerConnection.setLocalDescription(offer);
        didIOffer = true;
        // send offer to signaling server
        socket.emit('signaling:new-offer', offer);

        hangUpButton.setAttribute("style", "display: block");
        callButton.setAttribute("style", "display: none");
    } catch (error) {
        console.log(error);
    }
};

const answerOffer = async (commonPayload) => {
    const gotUserMedia = await fetchUserMedia();

    if (!gotUserMedia) return;

    const peerConnectionCreated = await createPeerConnection(commonPayload);

    if (!peerConnectionCreated) return;

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    commonPayload.answer = answer;

    const offererIceCandidates = await socket.emitWithAck('signaling:new-answer', commonPayload);
    console.log(offererIceCandidates);

    offererIceCandidates.forEach(c => {
        peerConnection.addIceCandidate(c);
        console.log("Added ice candidate");
    });

    hangUpButton.setAttribute("style", "display: block");
    callButton.setAttribute("style", "display: none");
};

const addAnswer = async (commonPayload) => {
    // client1, the original user sets his remote desc
    await peerConnection.setRemoteDescription(commonPayload.answer);
};

const addNewIceCandidate = (iceCandidate) => {
    peerConnection.addIceCandidate(iceCandidate)
    console.log("Added Ice Candidate");
};

const hangUp = () => {
    hangUpButton.setAttribute("style", "display: none");
    callButton.setAttribute("style", "display: block");

    peerConnection.close();
    remoteStream = null;
    remoteVideoEl.srcObject = null;

    localStream.getTracks().forEach(track => {
        track.stop();
    });
    localStream = null;
    localVideoEl.srcObject = null;
};

const hangUpAndEmit = () => {
    hangUp();
    socket.emit("hang-up", userName);
};

callButton.addEventListener("click", call);
hangUpButton.addEventListener("click", hangUpAndEmit);

const createOfferEls = (commonPayloads) => {
    callButton.setAttribute("style", "display: none");

    // make green answer button for this new offer
    commonPayloads.forEach(p => {
        const button = document.createElement('button');

        button.className = "bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded mr-2";
        button.innerText = `Answer ${p.offererUserName}`;

        button.addEventListener('click', (e) => {
            answerOffer(p);
            answerEl.removeChild(e.target);
        });

        answerEl.appendChild(button);
    });
};
