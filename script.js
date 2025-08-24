"use strict";

const SIZE = 5;
const data = [];

let gc = null;
let initialPx, initialPy;
let px, py;
let playerColor = 0; // 0: none, 1: red, 2: blue, 3: green
let initialColorPoints = [];
let colorPoints = [11, 22, 33]; // 11: red, 22: blue, 33: green
let targetScores = { red: 0, blue: 0, green: 0 };
let isGameOver = false;
let count = 0;
let perfect = [0, 0, 0, 0, 0]; // 0:not-cleared, 1: cleared, 2: perfect
let totalScore = 0;

function getRandomEmptyPosition() {
    let x, y;
    do {
        x = Math.floor(Math.random() * SIZE) + 1;
        y = Math.floor(Math.random() * SIZE) + 1;
    } while (data[y][x] != 0);
    return { x, y };
}

document.addEventListener("DOMContentLoaded", () => {
    gc = document.getElementById("canvas").getContext("2d");
    for (let y = 0; y < SIZE + 2; y++) {
        let row = [];
        for (let x = 0; x < SIZE + 2; x++) {
            row.push(x === 0 || x === SIZE + 1 || y === 0 || y === SIZE + 1 ? 6 : 0); //sentinel
        }
        data.push(row);
    }

    initializeGame();
    window.onkeydown = mykeydown;
    repaint();
});

function initializeGame() {
    initialColorPoints = [];
    for (let i = 0; i < 3; i++) {
        let { x, y } = getRandomEmptyPosition();
        data[y][x] = colorPoints[i];
        initialColorPoints.push({ x, y, value: colorPoints[i] });
    }
    ({ x: px, y: py } = getRandomEmptyPosition());
    initialPx = px;
    initialPy = py;

    setTargetScores();
    repaint();
}

function setTargetScores() {
    let remainingScore = SIZE * SIZE - 3;
    targetScores.red = Math.floor(Math.random() * (remainingScore - 1)) + 1;
    remainingScore -= (targetScores.red - 1);
    targetScores.blue = Math.floor(Math.random() * (remainingScore - 1)) + 1;
    remainingScore -= (targetScores.blue - 1);
    targetScores.green = remainingScore + 1;

    document.getElementById("scores.red").textContent = targetScores.red;
    document.getElementById("scores.blue").textContent = targetScores.blue;
    document.getElementById("scores.green").textContent = targetScores.green;
}

function mykeydown(e) {
    if (isGameOver) return;

    let dx = px;
    let dy = py;
    switch (e.keyCode) {
        case 37: dx--; break; //left
        case 38: dy--; break; //up
        case 39: dx++; break; //right
        case 40: dy++; break; //down
    }
    
    if (data[dy][dx] != 6) {
        // Impossible to go to the same color
        // if (data[dy][dx] > 0 && data[dy][dx] < 11) {
        //     return;
        // }
        // Possible to go to the same color
        if (data[dy][dx] > 0 && data[dy][dx] !== playerColor && data[dy][dx] !== 11 && data[dy][dx] !== 22 && data[dy][dx] !== 33) {
            return;
        }
        if (playerColor > 0) {
            data[py][px] = playerColor;
            count++;
        }

        px = dx;
        py = dy;

        if (data[dy][dx] == 11) {
            playerColor = 1; // red
        } else if (data[dy][dx] == 22) {
            playerColor = 2; // blue
        } else if (data[dy][dx] == 33) {
            playerColor = 3; // green
        }
        data[dy][dx] = playerColor;
    }

    check();
    repaint();
}

function repaint() {
    gc.fillStyle = "white";
    gc.lineWidth = 1;
    gc.fillRect(0, 0, (SIZE + 2) * 50, (SIZE + 2) * 50);

    for (let y = 1; y < data.length - 1; y++) {
        for (let x = 1; x < data[y].length - 1; x++) {
            if (data[y][x] == 1) {
                gc.fillStyle = "#ff5252";
            } else if (data[y][x] == 2) {
                gc.fillStyle = "#7192f5";
            } else if (data[y][x] == 3) {
                gc.fillStyle = "#30cf8a";
            } else if (!isGameOver){
                gc.fillStyle = "white";
            } else {
                gc.fillStyle = "#ddd";
            }
            gc.fillRect(x * 50, y * 50, 50, 50);
            gc.strokeStyle = "#432";
            gc.strokeRect(x * 50, y * 50, 50, 50);

            if (data[y][x] == 11) {
                gc.fillStyle = "#ff5252";
                gc.beginPath();
                gc.arc(x * 50 + 25, y * 50 + 25, 10, 0, Math.PI * 2);
                gc.fill();
            } else if (data[y][x] == 22) {
                gc.fillStyle = "#7192f5";
                gc.beginPath();
                gc.arc(x * 50 + 25, y * 50 + 25, 10, 0, Math.PI * 2);
                gc.fill();
            } else if (data[y][x] == 33) {
                gc.fillStyle = "#30cf8a";
                gc.beginPath();
                gc.arc(x * 50 + 25, y * 50 + 25, 10, 0, Math.PI * 2);
                gc.fill();
            }
        }
    }

    // Player design
    if (playerColor == 1) {
        gc.fillStyle = "#ff5252";
    } else if (playerColor == 2) {
        gc.fillStyle = "#7192f5";
    } else if (playerColor == 3) {
        gc.fillStyle = "#30cf8a";
    } else {
        gc.fillStyle = "white"; 
    }
    gc.fillRect(px * 50 + 15, py * 50 + 15, 20, 20);
    gc.strokeStyle = "#432";
    gc.strokeRect(px * 50 + 15, py * 50 + 15, 20, 20);

    drawCircle();

    if (isGameOver) {
        gc.font = "bold 60px Philosopher, sans-serif";
        gc.textAlign = "center";
        gc.strokeStyle = "black";
        gc.lineWidth = 5;
        gc.strokeText("Game Over", (SIZE + 2) * 25, (SIZE + 2) * 25 + 20);
        gc.fillStyle = "red";
        gc.fillText("Game Over", (SIZE + 2) * 25, (SIZE + 2) * 25 + 20);
    }
}

function check() {
    let scores = { red: 0, blue: 0, green: 0 };
    for (let y = 1; y < SIZE + 1; y++) {
        for (let x = 1; x < SIZE + 1; x++) {
            if (data[y][x] == 1) {
                scores.red++;
            } else if (data[y][x] == 2) {
                scores.blue++;
            } else if (data[y][x] == 3) {
                scores.green++;
            }
        }
    }

    if (scores.red == targetScores.red && scores.blue == targetScores.blue && scores.green == targetScores.green) { 
        // クリア
        perfect[totalScore] = 1;
        if (count == SIZE * SIZE - 1) perfect[totalScore] = 2;
        totalScore++;
        drawCircle();
        if (totalScore == 5) {
            document.getElementById("fin").textContent = "Complete!";
        } else {
            nextGame();
        }
    } else if (scores.red > targetScores.red || scores.blue > targetScores.blue || scores.green > targetScores.green || !canMove() || !isColorEnough(scores)) { 
        // ターゲットスコアを超える/動けない/色が足りない場合はゲームオーバー
        isGameOver = true;
    } 
}

// 動けるかどうか
function canMove() {
    const dirs = [
        { dx: 0, dy: -1 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 }
    ];
    for (let { dx, dy } of dirs) {
        let nx = px + dx, ny = py + dy;
        if (data[ny][nx] == 6) continue; // 壁は動けない
        if (data[ny][nx] == 0) return true; // 空きマスは動ける
        if (data[ny][nx] == playerColor || data[ny][nx] == 11 || data[ny][nx] == 22 || data[ny][nx] == 33) return true; // 自分の色 or 色の起点は動ける
    }
    return false;
}

function isColorEnough(scores) {
    if (scores.red >= 1 && scores.red < targetScores.red && playerColor != 1) return false;
    if (scores.blue >= 1 && scores.blue < targetScores.blue && playerColor != 2) return false;
    if (scores.green >= 1 && scores.green < targetScores.green && playerColor != 3) return false;
    return true;
}

// ゲームを最初から始める
function startNewGame() {
    isGameOver = false;
    playerColor = 0;
    count = 0;
    totalScore = 0;
    perfect = [0, 0, 0, 0, 0];
    drawCircle();

    for (let y = 1; y <= SIZE; y++) {
        for (let x = 1; x <= SIZE; x++) {
            data[y][x] = 0;
        }
    }

    initializeGame();
    document.getElementById("fin").textContent = "";
}

// 次の盤面へ
function nextGame() {
    isGameOver = false;
    playerColor = 0;
    count = 0;

    for (let y = 1; y <= SIZE; y++) {
        for (let x = 1; x <= SIZE; x++) {
            data[y][x] = 0;
        }
    }

    initializeGame();
    document.getElementById("fin").textContent = "";
}

// 同じ盤面をリトライ
// function resetGame() {
//     isGameOver = false;
//     playerColor = 0;

//     for (let y = 1; y < SIZE + 1; y++) {
//         for (let x = 1; x < SIZE + 1; x++) {
//             if (data[y][x] === 1 || data[y][x] === 2 || data[y][x] === 3) {
//                 data[y][x] = 0;
//             }
//         }
//     }

//     initialColorPoints.forEach(({ x, y, value }) => {
//         data[y][x] = value;
//     });

//     px = initialPx;
//     py = initialPy;

//     document.getElementById("fin").textContent = "";
//     totalScore = 0;
//     count = 0;
//     perfect = [0, 0, 0, 0, 0];

//     repaint();
// }

function drawCircle() {
    const ctx = document.getElementById("canvasCircle").getContext("2d");
    ctx.clearRect(0, 0, 200, 50);
    for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(20 + i*40, 25, 10, 0, Math.PI * 2);
        if (perfect[i] == 0) ctx.fillStyle = "white"
        else if (perfect[i] == 1) ctx.fillStyle = "gold";
        else if (perfect[i] == 2) ctx.fillStyle = "#f27efc";
        ctx.fill();
        ctx.strokeStyle = "#432";
        ctx.stroke();
    }
}

document.getElementById("restart").addEventListener("click", startNewGame);
