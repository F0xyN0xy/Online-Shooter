const socket = io();

const lobby = document.getElementById("lobby");
const roomInput = document.getElementById("roomInput");
const joinBtn = document.getElementById("joinBtn");
const roomListDiv = document.getElementById("roomList");

const gameContainer = document.getElementById("gameContainer");
const leaveBtn = document.getElementById("leaveBtn");
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let currentRoom = "";
let player = { x: 100, y: 100 };
let otherPlayers = {};
let keys = {};

// Lobby-Buttons
joinBtn.addEventListener("click", () => {
    const roomName = roomInput.value.trim();
    if(roomName){
        currentRoom = roomName;
        socket.emit("joinRoom", roomName);
        lobby.style.display = "none";
        gameContainer.style.display = "flex";
    }
});

leaveBtn.addEventListener("click", () => {
    socket.emit("leaveRoom", currentRoom);
    currentRoom = "";
    lobby.style.display = "flex";
    gameContainer.style.display = "none";
    otherPlayers = {};
});

// Map
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

function getRandomMap(){
    return maps[Math.floor(Math.random() * maps.length)];
}

let currentMap = getRandomMap();

// Key capture
document.addEventListener("keydown", (e) => keys[e.key] = true);
document.addEventListener("keyup", (e) => keys[e.key] = false);

function canMove(x, y){
    const cellSize = 50; // Größe einer Map-Zelle
    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);
    return currentMap[row] && currentMap[row][col] === 0;
}

function updatePlayer(){
    let newX = player.x;
    let newY = player.y;

    if(keys["w"]) newY -= 5;
    if(keys["s"]) newY += 5;
    if(keys["a"]) newX -= 5;
    if(keys["d"]) newX += 5;

    if(canMove(newX, newY)){
        player.x = newX;
        player.y = newY;
    }

    if(currentRoom){
        socket.emit("move", { room: currentRoom, x: player.x, y: player.y });
    }
}
setInterval(updatePlayer, 50);

// Shooting
let bullets = [];

document.addEventListener("click", (e)=>{
    // Richtung berechnen
    const dx = e.clientX - player.x;
    const dy = e.clientY - player.y;
    const angle = Math.atan2(dy, dx);

    bullets.push({ x: player.x+10, y: player.y+10, angle });
    socket.emit("shoot", { room: currentRoom, x: player.x+10, y: player.y+10, angle });
});

socket.on("playerShot", (data)=>{
    bullets.push({ x: data.x, y: data.y, angle: data.angle });
});

// Network Events
socket.on("playerMoved", (data) => {
    if(data.id !== socket.id){
        if(!otherPlayers[data.id]) otherPlayers[data.id] = { x: data.x, y: data.y };
        else {
            otherPlayers[data.id].targetX = data.x;
            otherPlayers[data.id].targetY = data.y;
        }
    }
});

socket.on("currentPlayers", (players) => {
    otherPlayers = {};
    for(let id in players){
        if(id !== socket.id) otherPlayers[id] = { x: players[id].x, y: players[id].y };
        else player.x = players[id].x, player.y = players[id].y;
    }
});

socket.on("roomList", (rooms) => {
    roomListDiv.innerHTML = "<h3>Rooms:</h3>" + rooms.map(r => `<div>${r}</div>`).join("");
});

// Drawing
function lerp(a,b,t){ return a + (b-a)*t; }
function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle="blue"; ctx.fillRect(player.x,player.y,20,20);
    ctx.fillStyle="red";
    for(let id in otherPlayers){
        let p = otherPlayers[id];
        if(p.targetX !== undefined && p.targetY !== undefined){
            p.x = lerp(p.x,p.targetX,0.2);
            p.y = lerp(p.y,p.targetY,0.2);
        }
        ctx.fillRect(p.x,p.y,20,20);
    }
    requestAnimationFrame(draw);
}
function drawFog(){
    ctx.fillStyle = "rgba(0,0,0,0.9)";
    ctx.fillRect(0,0,canvas.width,canvas.height);

    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(player.x+10, player.y+10, 100, 0, Math.PI*2); // Sichtkreis
    ctx.fill();
    ctx.restore();
}
function drawBullets(){
    ctx.fillStyle = "yellow";
    bullets.forEach((b)=>{
        b.x += Math.cos(b.angle)*10;
        b.y += Math.sin(b.angle)*10;
        ctx.fillRect(b.x, b.y, 5, 5);
    });
}

function gameLoop(){
    draw();
    drawFog();
    drawBullets();
    requestAnimationFrame(gameLoop);
}

gameLoop();