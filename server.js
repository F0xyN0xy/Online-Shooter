const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static(__dirname));

let rooms = {}; // { roomName: { players: {}, map } }

// Random Maps
const maps = [
    [
        [0,0,0,0,1,0,0,0],
        [0,1,0,0,1,0,1,0],
        [0,0,0,1,0,0,0,0],
        [1,0,0,0,0,1,0,0]
    ],
    [
        [1,0,0,1,0,0,1,0],
        [0,0,1,0,1,0,0,0],
        [0,1,0,0,0,1,0,0],
        [0,0,0,1,0,0,0,1]
    ]
];

function getRandomMap() {
    return maps[Math.floor(Math.random() * maps.length)];
}

io.on("connection", (socket) => {
    console.log("Player connected:", socket.id);

    socket.on("joinRoom", (roomName) => {
        if(!rooms[roomName]){
            rooms[roomName] = { players: {}, map: getRandomMap() };
        }
        socket.join(roomName);
        rooms[roomName].players[socket.id] = { x: 100, y: 100 };

        // send current map
        socket.emit("mapData", rooms[roomName].map);

        // Send player positions
        io.to(roomName).emit("currentPlayers", rooms[roomName].players);

        // List of all rooms
        io.emit("roomList", Object.keys(rooms));
    });

    socket.on("leaveRoom", (roomName) => {
        socket.leave(roomName);
        if(rooms[roomName]){
            delete rooms[roomName].players[socket.id];
            io.to(roomName).emit("currentPlayers", rooms[roomName].players);
            if(Object.keys(rooms[roomName].players).length === 0){
                delete rooms[roomName];
                io.emit("roomList", Object.keys(rooms));
            }
        }
    });

    socket.on("move", (data) => {
        const roomName = data.room;
        if(rooms[roomName] && rooms[roomName].players[socket.id]){
            rooms[roomName].players[socket.id].x = data.x;
            rooms[roomName].players[socket.id].y = data.y;
            socket.to(roomName).emit("playerMoved", { id: socket.id, x: data.x, y: data.y });
        }
    });

    socket.on("shoot", (data)=>{
        socket.to(data.room).emit("playerShot", data);
    });

    socket.on("disconnecting", () => {
        const roomsJoined = Object.keys(socket.rooms).filter(r => r !== socket.id);
        roomsJoined.forEach(roomName => {
            if(rooms[roomName]){
                delete rooms[roomName].players[socket.id];
                io.to(roomName).emit("currentPlayers", rooms[roomName].players);
                if(Object.keys(rooms[roomName].players).length === 0){
                    delete rooms[roomName];
                    io.emit("roomList", Object.keys(rooms));
                }
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server runs on Port ${PORT}`));