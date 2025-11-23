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
let bullets = [];
let keys = {};
let currentMap = [];
const cellSize = 50;

// Lobby
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
    bullets = [];
});

// Tasten
document.addEventListener("keydown", (e) => keys[e.key] = true);
document.addEventListener("keyup", (e) => keys[e.key] = false);

// Bewegung & Kollision
function canMove(x,y){
    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);
    return currentMap[row] && currentMap[row][col] === 0;
}

function updatePlayer(){
    if(!currentRoom) return;

    let newX = player.x;
    let newY = player.y;

    if(keys["w"]) newY -= 5;
    if(keys["s"]) newY += 5;
    if(keys["a"]) newX -= 5;
    if(keys["d"]) newX += 5;

    if(canMove(newX,newY)){
        player.x = newX;
        player.y = newY;
    }

    socket.emit("move", { room: currentRoom, x: player.x, y: player.y });
}
setInterval(updatePlayer,50);

// Shooting
document.addEventListener("click",(e)=>{
    const dx = e.clientX - player.x;
    const dy = e.clientY - player.y;
    const angle = Math.atan2(dy,dx);
    bullets.push({ x: player.x+10, y: player.y+10, angle });
    socket.emit("shoot",{ room: currentRoom, x: player.x+10, y: player.y+10, angle });
});

socket.on("playerShot", (data)=>{ bullets.push({ x: data.x, y: data.y, angle: data.angle }); });

// Network Events
socket.on("playerMoved", (data) => {
    if(data.id !== socket.id){
        if(!otherPlayers[data.id]) otherPlayers[data.id] = { x: data.x, y: data.y };
        else { otherPlayers[data.id].targetX = data.x; otherPlayers[data.id].targetY = data.y; }
    }
});

socket.on("currentPlayers", (players) => {
    otherPlayers = {};
    for(let id in players){
        if(id !== socket.id) otherPlayers[id] = { x: players[id].x, y: players[id].y };
        else player.x = players[id].x; player.y = players[id].y;
    }
});

socket.on("mapData", (map)=>{ currentMap = map; });

socket.on("roomList", (rooms) => {
    roomListDiv.innerHTML = "<h3>Rooms:</h3>" + rooms.map(r => `<div>${r}</div>`).join("");
});

// Draw
function lerp(a,b,t){ return a+(b-a)*t; }

function drawMap(){
    for(let row=0; row<currentMap.length; row++){
        for(let col=0; col<currentMap[row].length; col++){
            if(currentMap[row][col]===1){
                ctx.fillStyle="gray";
                ctx.fillRect(col*cellSize,row*cellSize,cellSize,cellSize);
            }
        }
    }
}

function drawBullets(){
    ctx.fillStyle="yellow";
    bullets.forEach((b)=>{
        b.x += Math.cos(b.angle)*10;
        b.y += Math.sin(b.angle)*10;
        ctx.fillRect(b.x,b.y,5,5);
    });
}

function drawFog(){
    ctx.fillStyle="rgba(0,0,0,0.9)";
    ctx.fillRect(0,0,canvas.width,canvas.height);

    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(player.x+10, player.y+10, 150, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
}

function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    drawMap();

    // Player
    ctx.fillStyle="blue"; ctx.fillRect(player.x,player.y,20,20);
    ctx.fillStyle="red";
    for(let id in otherPlayers){
        let p = otherPlayers[id];
        if(p.targetX!==undefined && p.targetY!==undefined){
            p.x = lerp(p.x,p.targetX,0.2);
            p.y = lerp(p.y,p.targetY,0.2);
        }
        ctx.fillRect(p.x,p.y,20,20);
    }

    drawBullets();
    drawFog();
    requestAnimationFrame(draw);
}

draw();