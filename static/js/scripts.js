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

const createPeerConnection = async (offerObj) => {
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
                socket.emit('sendIceCandidateToSignalingServer', {
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

        if (offerObj) {
            await peerConnection.setRemoteDescription(offerObj.offer);
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
        socket.emit('newOffer', offer);
    } catch (error) {
        console.log(error);
    }
};

const answerOffer = async (offerObj) => {
    const gotUserMedia = await fetchUserMedia();

    if (!gotUserMedia) return;

    const peerConnectionCreated = await createPeerConnection(offerObj);

    if (!peerConnectionCreated) return;

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    offerObj.answer = answer;

    const offerIceCandidates = await socket.emitWithAck('newAnswer', offerObj);
    console.log(offerIceCandidates);

    offerIceCandidates.forEach(c => {
        peerConnection.addIceCandidate(c);
        console.log("Added ice candidate");
    });
};

const addAnswer = async (offerObj) => {
    // client1, the original user sets his remote desc
    await peerConnection.setRemoteDescription(offerObj.answer);
};

const addNewIceCandidate = (iceCandidate) => {
    peerConnection.addIceCandidate(iceCandidate)
    console.log("Added Ice Candidate");
};


document.querySelector("#call").addEventListener("click", call);

const createOfferEls = (offers) => {
    // make green answer button for this new offer
    const answerEl = document.querySelector('#answer');
    offers.forEach(o => {
        console.log(o);
        const newOfferEl = document.createElement('div');
        newOfferEl.innerHTML = `<button class="btn btn-success col-1">Answer ${o.offererUserName}</button>`
        newOfferEl.addEventListener('click',()=>answerOffer(o))
        answerEl.appendChild(newOfferEl);
    });
};
