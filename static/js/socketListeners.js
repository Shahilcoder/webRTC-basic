socket.on('availableOffers', offers => {
    console.log(offers);
    createOfferEls(offers);
});

socket.on('newOffersAwaiting', offers => {
    console.log("new offer", offers);
    createOfferEls(offers);
});

socket.on('answerResponse', offerObj => {
    console.log(offerObj);
    addAnswer(offerObj);
});

socket.on("receivedIceCandidateFromServer", iceCandidate => {
    console.log(iceCandidate);
    addNewIceCandidate(iceCandidate);
});
