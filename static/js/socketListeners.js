socket.on('signaling:available-offers', commonPayloads => {
    createOfferEls(commonPayloads);
});

socket.on('signaling:new-offer-awaiting', commonPayloads => {
    console.log("new offer", commonPayloads);
    createOfferEls(commonPayloads);
});

socket.on('signaling:answer-response', commonPayload => {
    addAnswer(commonPayload);
});

socket.on("signaling:responded-with-ice-candidate", iceCandidate => {
    addNewIceCandidate(iceCandidate);
});

socket.on("user-hang-up", () => {
    hangUp();
});
