const socket = io();

const myFace = document.querySelector("#myFace");
const myFace2 = document.querySelector("#myFace2");
const muteBtn = document.querySelector("#mute");
const muteIcon = muteBtn.querySelector(".muteIcon");
const unMuteIcon = muteBtn.querySelector(".unMuteIcon");
const cameraBtn = document.querySelector("#camera");
const cameraIcon = cameraBtn.querySelector(".cameraIcon");
const unCameraIcon = cameraBtn.querySelector(".unCameraIcon");
const camerasSelect = document.querySelector("#cameras");
const screenBtn = document.querySelector("#screen");
const screenIcon = document.querySelector(".screenIcon");
const unScreenIcon = document.querySelector(".unScreenIcon");
const $public_room = document.querySelector("#public_room");

const call = document.querySelector("#call");
const welcome = document.querySelector("#welcome");

const HIDDEN_CN = "hidden";

var globalDivId = new Array();

let myStream;
let muted = true;
unMuteIcon.classList.add(HIDDEN_CN);
let cameraOff = false;
unCameraIcon.classList.add(HIDDEN_CN);
let screenShareGreen = true;
unScreenIcon.classList.add(HIDDEN_CN);

let roomName = "";
let nickname = "";
let peopleInRoom = 1;

let pcObj = {};

let shared = true;

async function getCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter((device) => device.kind === "videoinput");
        const currentCamera = myStream.getVideoTracks();
        cameras.forEach((camera) => {
            const option = document.createElement("option");
            option.value = camera.deviceId;
            option.innerText = camera.label;

            if (currentCamera.label == camera.label) {
                option.selected = true;
            }

            camerasSelect.appendChild(option);
        });
    } catch (error) {
        console.log(error);
    }
}

async function getMedia(deviceId) {
    const initialConstraints = {
        audio: true,
        video: { facingMode: "user" },
    };
    const cameraConstraints = {
        audio: true,
        video: { deviceId: { exact: deviceId } },
    };

    try {
        myStream = await navigator.mediaDevices.getUserMedia(deviceId ? cameraConstraints : initialConstraints);

        myFace.srcObject = myStream;
        myFace.muted = true;

        if (!deviceId) {
            myStream //
                .getAudioTracks()
                .forEach((track) => (track.enabled = false));

            await getCameras();
        }
    } catch (error) {
        console.log(error);
    }
}

function handleMuteClick() {
    myStream.getAudioTracks().forEach((track) => (track.enabled = !track.enabled));
    if (muted) {
        unMuteIcon.classList.remove(HIDDEN_CN);
        muteIcon.classList.add(HIDDEN_CN);
        muted = false;
    } else {
        muteIcon.classList.remove(HIDDEN_CN);
        unMuteIcon.classList.add(HIDDEN_CN);
        muted = true;
    }
}

function handleCameraClick() {
    myStream.getVideoTracks().forEach((track) => (track.enabled = !track.enabled));
    if (cameraOff) {
        cameraIcon.classList.remove(HIDDEN_CN);
        unCameraIcon.classList.add(HIDDEN_CN);
        cameraOff = false;
    } else {
        unCameraIcon.classList.remove(HIDDEN_CN);
        cameraIcon.classList.add(HIDDEN_CN);
        cameraOff = true;
    }
}

async function handleCameraChange() {
    try {
        await getMedia(camerasSelect.value);
        if (peerConnectionObjArr.length > 0) {
            const newVideoTrack = myStream.getVideoTracks()[0];
            peerConnectionObjArr.forEach((peerConnectionObj) => {
                const peerConnection = peerConnectionObj.connection;
                const peerVideoSender = peerConnection.getSenders().find((sender) => sender.track.kind == "video");
                peerVideoSender.replaceTrack(newVideoTrack);
            });
        }
    } catch (error) {
        console.log(error);
    }
}

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input", handleCameraChange);
screenBtn.addEventListener("click", startCapture);

let captureStream = null;
async function startCapture() {
    if (screenShareGreen) {
        unScreenIcon.classList.remove(HIDDEN_CN);
        screenIcon.classList.add(HIDDEN_CN);
        screenShareGreen = false;
        try {
            myScreen = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true,
            });
            myFace.srcObject = myScreen;
            if (pcObj) {
                const newVideoTrack = myScreen.getVideoTracks()[0];
                for (var key in pcObj) {
                    const peerConnection = pcObj[key];
                    const peerVideoSender = peerConnection.getSenders().find((sender) => sender.track.kind == "video");
                    peerVideoSender.replaceTrack(newVideoTrack);
                }
            }
        } catch (error) {
            console.error(error);
        }
    } else {
        screenIcon.classList.remove(HIDDEN_CN);
        unScreenIcon.classList.add(HIDDEN_CN);
        screenShareGreen = true;
        try {
            const screenTrack = myStream.getVideoTracks()[0];
            for (var key in pcObj) {
                const userConnection = pcObj[key];
                const peerVideoSender = userConnection.getSenders().find((sender) => sender.track.kind == "video");
                peerVideoSender.replaceTrack(screenTrack);
                myScreen.getTracks().forEach((track) => track.stop());
                myFace.srcObject = myStream;
            }
        } catch (error) {
            console.error(error);
        }
    }
}

const FullBtn = document.querySelector("#fullScreen");

FullBtn.addEventListener("click", toggleFullScreen);

function toggleFullScreen() {
    if (!myFace2.fullscreenElement) {
        myFace2.requestFullscreen();
    } else {
        if (myFace2.exitFullscreen) {
            myFace2.exitFullscreen();
        }
    }
}

call.classList.add(HIDDEN_CN);

const welcomeForm = welcome.querySelector("form");

async function initCall() {
    welcome.hidden = true;
    $public_room.hidden = true;
    call.classList.remove(HIDDEN_CN);
    await getMedia();
}

async function handleWelcomeSubmit(event) {
    event.preventDefault();

    if (socket.disconnected) {
        socket.connect();
    }

    const welcomeRoomName = welcomeForm.querySelector("#roomName");
    const welcomeNickname = welcomeForm.querySelector("#nickname");
    const nicknameContainer = document.querySelector("#userNickname");
    roomName = welcomeRoomName.value;
    welcomeRoomName.value = "";
    nickname = welcomeNickname.value;
    welcomeNickname.value = "";
    nicknameContainer.innerText = nickname;
    socket.emit("join_room", roomName, nickname);
}

welcomeForm.addEventListener("submit", handleWelcomeSubmit);

const chatForm = document.querySelector("#chatForm");
const chatBox = document.querySelector("#chatBox");

const MYCHAT_CN = "myChat";
const NOTICE_CN = "noticeChat";

chatForm.addEventListener("submit", handleChatSubmit);

function handleChatSubmit(event) {
    event.preventDefault();
    const chatInput = chatForm.querySelector("input");
    const message = chatInput.value;
    chatInput.value = "";
    socket.emit("chat", `${nickname}: ${message}`, roomName);
    writeChat(`You: ${message}`, MYCHAT_CN);
}

function writeChat(message, className = null) {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.innerText = message;
    li.appendChild(span);
    li.classList.add(className);
    chatBox.prepend(li);
}

function setUserCount(cnt) {
    const $span = $room.querySelector("#user_count");
    $span.textContent = `${cnt} 명`;
}

const leaveBtn = document.querySelector("#leave");

function leaveRoom() {
    socket.disconnect();

    call.classList.add(HIDDEN_CN);
    welcome.hidden = false;
    $public_room.hidden = false;
    location.reload();

    peerConnectionObjArr = [];
    peopleInRoom = 1;
    nickname = "";

    myStream.getTracks().forEach((track) => track.stop());
    const nicknameContainer = document.querySelector("#userNickname");
    nicknameContainer.innerText = "";

    myFace.srcObject = null;
    clearAllVideos();
    clearAllChat();
}

function removeVideo(leavedSocketId) {
    const streams = document.querySelector("#videoList");
    const streamArr = streams.querySelectorAll("div");
    streamArr.forEach((streamElement) => {
        if (streamElement.id === leavedSocketId) {
            streams.removeChild(streamElement);
        }
    });
}

function clearAllVideos() {
    const streams = document.querySelector("#videoList");
    const streamArr = streams.querySelectorAll("div");
    streamArr.forEach((streamElement) => {
        if (streamElement.id != "myStream") {
            streams.removeChild(streamElement);
        }
    });
}

function clearAllChat() {
    const chatArr = chatBox.querySelectorAll("li");
    chatArr.forEach((chat) => chatBox.removeChild(chat));
}

leaveBtn.addEventListener("click", leaveRoom);

const modal = document.querySelector(".modal");
const modalText = modal.querySelector(".modal__text");
const modalBtn = modal.querySelector(".modal__btn");

function paintModal(text) {
    modalText.innerText = text;
    modal.classList.remove(HIDDEN_CN);

    modal.addEventListener("click", removeModal);
    modalBtn.addEventListener("click", removeModal);
    document.addEventListener("keydown", handleKeydown);
}

function removeModal() {
    modal.classList.add(HIDDEN_CN);
    modalText.innerText = "";
}

function handleKeydown(event) {
    if (event.code === "Escape" || event.code === "Enter") {
        removeModal();
    }
}

socket.on("reject_join", () => {
    paintModal("Sorry, The room is already full.");

    const nicknameContainer = document.querySelector("#userNickname");
    nicknameContainer.innerText = "";
    roomName = "";
    nickname = "";
});

socket.on("accept_join", async (userObjArr) => {
    await initCall();

    const length = userObjArr.length;
    if (length === 1) {
        return;
    }

    writeChat("Notice!", NOTICE_CN);
    for (let i = 0; i < length - 1; ++i) {
        try {
            const newPC = createConnection(userObjArr[i].socketId, userObjArr[i].nickname);
            const offer = await newPC.createOffer();
            await newPC.setLocalDescription(offer);
            socket.emit("offer", offer, userObjArr[i].socketId, nickname);
            writeChat(`__${userObjArr[i].nickname}__`, NOTICE_CN);
        } catch (err) {
            console.error(err);
        }
    }
    writeChat("is in the room.", NOTICE_CN);
});

socket.on("offer", async (offer, remoteSocketId, remoteNickname) => {
    try {
        const newPC = createConnection(remoteSocketId, remoteNickname);
        await newPC.setRemoteDescription(offer);
        const answer = await newPC.createAnswer();
        await newPC.setLocalDescription(answer);
        socket.emit("answer", answer, remoteSocketId);
        writeChat(`notice! __${remoteNickname}__ joined the room`, NOTICE_CN);
    } catch (err) {
        console.error(err);
    }
});

socket.on("answer", async (answer, remoteSocketId) => {
    await pcObj[remoteSocketId].setRemoteDescription(answer);
});

socket.on("ice", async (ice, remoteSocketId) => {
    await pcObj[remoteSocketId].addIceCandidate(ice);
});

socket.on("chat", (message) => {
    writeChat(message);
});

socket.on("leave_room", (leavedSocketId, nickname) => {
    removeVideo(leavedSocketId);
    writeChat(`notice! ${nickname} leaved the room.`, NOTICE_CN);
    --peopleInRoom;
    sortStreams();
});
socket.on("current_rooms", ({ public_rooms }) => {
    const $ul = $public_room.querySelector("ul");
    $ul.innerHTML = "";
    public_rooms.forEach(({ roomName, user_count }) => {
        const $li = document.createElement("li");
        const $roomName = document.createElement("p");
        $roomName.textContent = `방 이름 : ${roomName}`;
        const $user_count = document.createElement("p");
        $user_count.textContent = `유저 수 : ${user_count} 명`;
        $li.appendChild($roomName);
        $li.appendChild($user_count);
        $ul.appendChild($li);
        $li.classList.add("chat-room");
        $li.roomName = roomName;
    });
});
socket.on("welcome", ({ nickname, user_count }) => {
    setUserCount(user_count);
});
socket.on("bye", ({ nickname, user_count }) => {
    setUserCount(user_count);
});

function createConnection(remoteSocketId, remoteNickname) {
    const myPeerConnection = new RTCPeerConnection({
        iceServers: [
            {
                urls: [
                    "stun:stun.l.google.com:19302",
                    "stun:stun1.l.google.com:19302",
                    "stun:stun2.l.google.com:19302",
                    "stun:stun3.l.google.com:19302",
                    "stun:stun4.l.google.com:19302",
                ],
            },
        ],
    });
    myPeerConnection.addEventListener("icecandidate", (event) => {
        handleIce(event, remoteSocketId);
    });
    myPeerConnection.addEventListener("addstream", (event) => {
        handleAddStream(event, remoteSocketId, remoteNickname);
    });

    myStream.getTracks().forEach((track) => myPeerConnection.addTrack(track, myStream));

    pcObj[remoteSocketId] = myPeerConnection;

    ++peopleInRoom;
    sortStreams();
    return myPeerConnection;
}

function handleIce(event, remoteSocketId) {
    if (event.candidate) {
        socket.emit("ice", event.candidate, remoteSocketId);
    }
}

function handleAddStream(event, remoteSocketId, remoteNickname) {
    const peerStream = event.stream;
    paintPeerFace(peerStream, remoteSocketId, remoteNickname);
}

function paintPeerFace(peerStream, id, remoteNickname) {
    const streams = document.querySelector("#videoList");
    const div = document.createElement("div");
    div.id = id;
    const video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true;
    video.width = "200";
    video.height = "200";
    video.srcObject = peerStream;
    const nicknameContainer = document.createElement("h3");
    nicknameContainer.id = "userNickname";
    nicknameContainer.innerText = remoteNickname;
    div.appendChild(video);
    globalDivId.push(div.id);
    div.appendChild(nicknameContainer);
    streams.appendChild(div);
    div.addEventListener("click", () => userCameraClick(peerStream, remoteNickname));
    sortStreams();
}

function userCameraClick(stream, nickName) {
    myFace2.srcObject = stream;
    const nicknameContainer = document.createElement("h3");
    userNickname.innerText = nickName;
}

function sortStreams() {
    const streams = document.querySelector("#videoList");
    const streamArr = streams.querySelectorAll("div");
    streamArr.forEach((stream) => (stream.className = `people${peopleInRoom}`));
}
