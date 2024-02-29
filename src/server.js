import express, { Router } from "express";
import SocketIO from "socket.io";
import http from "http";

const PORT = process.env.PORT || 4000;
const app = express();
var cons = require("consolidate");

const serveStatic = require("serve-static");
const session = require("express-session");
const path = require("path");
const cookieParser = require("cookie-parser");
const expressErrorHandler = require("express-error-handler");
const bodyParser = require("body-parser");
const FileStore = require("session-file-store")(session);
app.use(bodyParser.urlencoded({ extended: false }));

app.set("view engine", "ejs");
app.set("views", process.cwd() + "/src/views");
app.use("/public", express.static(process.cwd() + "/src/public"));

app.use(cookieParser());
app.use(
    session({
        secret: "daramG key",
        resave: false,
        saveUninitialized: true,
    })
);

app.get("/", (req, res) => {
    if (req.session.user_id) {
        req.session.is_logined = true;
        res.render("home.ejs", { user_nickname: req.session.user_nickname, is_logined: req.session.is_logined });
    } else {
        req.session.is_logined = false;
        res.render("home.ejs", { is_logined: req.session.is_logined });
    }
});

app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/");
});

app.get("/room", (req, res) => {
    if (req.session.user_id) {
        res.render("room", { user_nickname: req.session.user_nickname });
    } else {
        res.send("<script>alert('로그인 후 이용해주세요.');location.href='/';</script>");
    }
});

app.get("/login", (req, res) => {
    res.render("login");
});

app.get("/join", (req, res) => {
    res.render("login");
});

app.get("/*", (req, res) => {
    res.redirect("/");
});

var mysql = require("mysql");
var dbconn = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "0000",
    database: "webzoom",
    debug: false,
});

app.post("/signUpProcess", function (req, res, next) {
    var email = req.body.email;
    var username = req.body.username;
    var password = req.body.password;
    dbconn.query("SELECT email FROM user where email='" + email + "';", function (err, rows) {
        if (rows.length == 0) {
            const param = [email, username, password];
            dbconn.query("INSERT INTO user(`email`,`username`,`password`) VALUES (?,?,?)", param, (err, row) => {
                if (err) console.log(err);
            });
            res.send("success");
        } else {
            res.send("fail");
        }
    });
});

app.post("/loginProcess", function (req, res, next) {
    var email = req.body.email;
    var password = req.body.password;
    dbconn.query("SELECT email, username, password FROM user where email='" + email + "';", function (err, rows) {
        if (err) throw err;
        else {
            if (rows.length == 0) {
                res.send("fail");
            } else {
                var pw = rows[0].password;
                if (password === pw) {
                    var username = rows[0].username;
                    req.session.user_id = email;
                    req.session.user_nickname = username;
                    res.send("success");
                } else {
                    res.send("fail");
                }
            }
        }
    });
});

const httpServer = http.createServer(app);
const wsServer = SocketIO(httpServer);

let roomObjArr = [];
const MAXIMUM = 4;

function publicRooms() {
    const { sids, rooms } = wsServer.sockets.adapter;

    const public_rooms = [];
    rooms.forEach((_, key) => {
        if (sids.get(key) === undefined) {
            public_rooms.push({
                roomName: key,
                user_count: countRoomUsers(key),
            });
        }
    });
    return public_rooms;
}

function countRoomUsers(roomName) {
    return wsServer.sockets.adapter.rooms.get(roomName)?.size;
}

wsServer.on("connection", (socket) => {
    let myRoomName = null;
    let myNickname = null;
    wsServer.sockets.emit("current_rooms", { public_rooms: publicRooms() });
    socket.on("join_room", (roomName, nickname) => {
        myRoomName = roomName;
        myNickname = nickname;

        const leaving_room_name = roomName;
        let isRoomExist = false;
        let targetRoomObj = null;
        if (leaving_room_name) {
            socket.to(leaving_room_name).emit("bye", {
                nickname: socket.nickname,
                user_count: countRoomUsers(roomName) - 1,
            });
            socket.leave(leaving_room_name);
        }
        socket.join(roomName);
        wsServer.to(roomName).emit("welcome", {
            nickname: socket.nickname,
            user_count: countRoomUsers(roomName),
        });

        for (let i = 0; i < roomObjArr.length; ++i) {
            if (roomObjArr[i].roomName === roomName) {
                if (roomObjArr[i].currentNum >= MAXIMUM) {
                    socket.emit("reject_join");
                    return;
                }

                isRoomExist = true;
                targetRoomObj = roomObjArr[i];
                break;
            }
        }

        if (!isRoomExist) {
            targetRoomObj = {
                roomName,
                currentNum: 0,
                users: [],
            };
            roomObjArr.push(targetRoomObj);
        }

        targetRoomObj.users.push({
            socketId: socket.id,
            nickname,
        });
        ++targetRoomObj.currentNum;

        socket.join(roomName);
        socket.emit("accept_join", targetRoomObj.users);
        wsServer.sockets.emit("current_rooms", { public_rooms: publicRooms() });
    });

    socket.on("offer", (offer, remoteSocketId, localNickname) => {
        socket.to(remoteSocketId).emit("offer", offer, socket.id, localNickname);
    });

    socket.on("answer", (answer, remoteSocketId) => {
        socket.to(remoteSocketId).emit("answer", answer, socket.id);
    });

    socket.on("ice", (ice, remoteSocketId) => {
        socket.to(remoteSocketId).emit("ice", ice, socket.id);
    });

    socket.on("chat", (message, roomName) => {
        socket.to(roomName).emit("chat", message);
    });

    socket.on("disconnecting", () => {
        socket.to(myRoomName).emit("leave_room", socket.id, myNickname);
        socket.rooms.forEach((roomName) =>
            wsServer.to(roomName).emit("bye", {
                nickname: socket.nickname,
                user_count: countRoomUsers(roomName) - 1,
            })
        );
        let isRoomEmpty = false;
        for (let i = 0; i < roomObjArr.length; ++i) {
            if (roomObjArr[i].roomName === myRoomName) {
                const newUsers = roomObjArr[i].users.filter((user) => user.socketId != socket.id);
                roomObjArr[i].users = newUsers;
                --roomObjArr[i].currentNum;

                if (roomObjArr[i].currentNum == 0) {
                    isRoomEmpty = true;
                }
            }
        }
        wsServer.sockets.emit("current_rooms", { public_rooms: publicRooms() });

        if (isRoomEmpty) {
            const newRoomObjArr = roomObjArr.filter((roomObj) => roomObj.currentNum != 0);
            roomObjArr = newRoomObjArr;
        }
    });
});

const handleListen = () => console.log(`✅ Listening on http://localhost:${PORT}`);
httpServer.listen(PORT, handleListen);
