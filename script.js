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
let isAnimating = false;
let isPlaying = false;
let isGameOver = false;
let isGameCleared = false;
let countPerGame = 0; // 1ゲームごとの動いた回数
let countTotal = 0; // 5ゲームを通して動いた回数
let perfect = [0, 0, 0, 0, 0]; // 0:not-cleared, 1: cleared, 2: perfect
let totalScore = 0; // 何個クリアしているか
let startTime = 0; // ゲーム開始時刻（ms）
let elapsedTime = 0; // 経過時間（s）

const showListKeyframes = {
    opacity: [0, 1],
};
const hideListKeyframes = {
    opacity: [1, 0],
};
const options = {
    duration: 400,
    easing: 'ease',
    fill: 'forwards',
};

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

    repaint();
    
    document.getElementById("play").addEventListener("click", startGame);

    window.addEventListener("keydown", (e) => { // 矢印キー押下時もゲーム開始
        const arrowKeys = [37, 38, 39, 40];
        if (arrowKeys.includes(e.keyCode)) {
            startGame();
            window.addEventListener("keydown", mykeydown);
        }
    });

    // マイページ
    myPageButton.addEventListener("click", async () => {
        myPageModal.style.visibility = "visible";
        mask1.style.visibility = "visible";
        myPageModal.animate(showListKeyframes, options);
        mask1.animate(showListKeyframes, options);
    });

    // マイページの「閉じる」ボタン
    closeMyPageButton.addEventListener("click", () => {
        if (isAnimating) return; // すでにアニメーション中なら処理しない
        isAnimating = true;
        mask1.animate(hideListKeyframes, options);
        mask1.style.pointerEvents = "none";
        myPageModal.animate(hideListKeyframes, options).onfinish = () => { // アニメーション完了後にクリック許可
            mask1.style.pointerEvents = "auto";
            isAnimating = false;
            myPageModal.style.visibility = "hidden";
            mask1.style.visibility = "hidden";
        };
    });

    // マイページのマスク
    mask1.addEventListener("click", () => {
        closeMyPageButton.dispatchEvent(new PointerEvent("click"));
    });

    // 遊び方
    howToPlayButton.addEventListener("click", async () => {
        howToPlayModal.style.visibility = "visible";
        mask2.style.visibility = "visible";
        howToPlayModal.animate(showListKeyframes, options);
        mask2.animate(showListKeyframes, options);
    });

    // 遊び方の「閉じる」ボタン
    closeHowToPlayButton.addEventListener("click", () => {
        if (isAnimating) return; // すでにアニメーション中なら処理しない
        isAnimating = true;
        mask2.animate(hideListKeyframes, options);
        mask2.style.pointerEvents = "none";
        howToPlayModal.animate(hideListKeyframes, options).onfinish = () => { // アニメーション完了後にクリック許可
            mask2.style.pointerEvents = "auto";
            isAnimating = false;
            howToPlayModal.style.visibility = "hidden";
            mask2.style.visibility = "hidden";
        };
    });

    // 遊び方のマスク
    mask2.addEventListener("click", () => {
        closeHowToPlayButton.dispatchEvent(new PointerEvent("click"));
    });

    // ランキング
    rankingButton.addEventListener("click", async () => {
        rankingModal.style.visibility = "visible";
        mask3.style.visibility = "visible";
        rankingModal.animate(showListKeyframes, options);
        mask3.animate(showListKeyframes, options);
    });

    // ランキングの「閉じる」ボタン
    closeRankingButton.addEventListener("click", () => {
        if (isAnimating) return; // すでにアニメーション中なら処理しない
        isAnimating = true;
        mask3.animate(hideListKeyframes, options);
        mask3.style.pointerEvents = "none";
        rankingModal.animate(hideListKeyframes, options).onfinish = () => { // アニメーション完了後にクリック許可
            mask3.style.pointerEvents = "auto";
            isAnimating = false;
            rankingModal.style.visibility = "hidden";
            mask3.style.visibility = "hidden";
        };
    });

    // ランキングのマスク
    mask3.addEventListener("click", () => {
        closeRankingButton.dispatchEvent(new PointerEvent("click"));
    });
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
}

function startGame() {
    if (!isPlaying && !isGameOver && !isGameCleared) {
        isPlaying = true;
        startTime = Date.now();
        initializeGame();
        document.getElementById("play").style.display = "none"; 
        document.getElementById("quit").style.display = "block"; 
        requestAnimationFrame(loop);
    }
}

function loop() {
    if (isPlaying && !isGameOver && !isGameCleared) {
        elapsedTime = Math.floor((Date.now() - startTime) / 1000);
    }
    repaint();

    // ゲームが終わるまではループ
    if (isPlaying && !isGameOver && !isGameCleared) {
        requestAnimationFrame(loop);
    }
}

function formatTime(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    const mm = String(min).padStart(2, '0');
    const ss = String(sec).padStart(2, '0');
    return `${mm}:${ss}`;
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
    if (!isPlaying || isGameOver || isGameCleared) return;

    let dx = px;
    let dy = py;
    switch (e.keyCode) {
        case 37: dx--; break; // left
        case 38: dy--; break; // up
        case 39: dx++; break; // right
        case 40: dy++; break; // down
        default: return; // others
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
        if (playerColor > 0) { // 最初に色を取ってからカウント開始
            data[py][px] = playerColor;
            countPerGame++;
            countTotal++;
        }

        px = dx;
        py = dy;

        if (data[dy][dx] == 11) {
            if (playerColor == 0) { // 最初に色を取ったときはカウント
                countPerGame++;
                countTotal++;
            }
            playerColor = 1; // red
        } else if (data[dy][dx] == 22) {
            if (playerColor == 0) { // 最初に色を取ったときはカウント
                countPerGame++;
                countTotal++;
            }
            playerColor = 2; // blue
        } else if (data[dy][dx] == 33) {
            if (playerColor == 0) { // 最初に色を取ったときはカウント
                countPerGame++;
                countTotal++;
            }
            playerColor = 3; // green
        }
        data[dy][dx] = playerColor;
    }

    check();
    repaint();
}

function repaint(tileSize=60) {
    gc.fillStyle = "white";
    gc.lineWidth = 1.5;
    gc.fillRect(0, 0, SIZE * tileSize + 120, SIZE * tileSize + 10);

    for (let y = 1; y < data.length - 1; y++) {
        for (let x = 1; x < data[y].length - 1; x++) {
            if (data[y][x] == 1) {
                gc.fillStyle = "#ff5252";
            } else if (data[y][x] == 2) {
                gc.fillStyle = "#7192f5";
            } else if (data[y][x] == 3) {
                gc.fillStyle = "#30cf8a";
            } else if (!isGameOver && isPlaying){
                gc.fillStyle = "white";
            } else {
                gc.fillStyle = "#ddd";
            }
            gc.fillRect((x-1) * tileSize + 60, (y-1) * tileSize + 5, tileSize, tileSize);
            gc.strokeStyle = "#432";
            gc.strokeRect((x-1) * tileSize + 60, (y-1) * tileSize + 5, tileSize, tileSize);

            if (data[y][x] == 11) {
                gc.fillStyle = "#ff5252";
                gc.beginPath();
                gc.arc((x-1) * tileSize + 30 + 60, (y-1) * tileSize + 30 + 5, 12.5, 0, Math.PI * 2);
                gc.fill();
            } else if (data[y][x] == 22) {
                gc.fillStyle = "#7192f5";
                gc.beginPath();
                gc.arc((x-1) * tileSize + 30 + 60, (y-1) * tileSize + 30 + 5, 12.5, 0, Math.PI * 2);
                gc.fill();
            } else if (data[y][x] == 33) {
                gc.fillStyle = "#30cf8a";
                gc.beginPath();
                gc.arc((x-1) * tileSize + 30 + 60, (y-1) * tileSize + 30 + 5, 12.5, 0, Math.PI * 2);
                gc.fill();
            }
        }
    }

    // Player design
    if (isPlaying) {
        if (playerColor == 1) {
            gc.fillStyle = "#ff5252";
        } else if (playerColor == 2) {
            gc.fillStyle = "#7192f5";
        } else if (playerColor == 3) {
            gc.fillStyle = "#30cf8a";
        } else {
            gc.fillStyle = "white"; 
        }
        gc.fillRect((px-1) * tileSize + 17.5 + 60, (py-1) * tileSize + 17.5 + 5, 25, 25);
        gc.strokeStyle = "#432";
        gc.strokeRect((px-1) * tileSize + 17.5 + 60, (py-1) * tileSize + 17.5 + 5, 25, 25);
    }

    drawCircle();

    if (isGameCleared) { // GameClear
        let fontSize = SIZE * 10 + 20;
        gc.font = `bold ${fontSize}px Philosopher, sans-serif`;
        gc.textAlign = "center";
        gc.strokeStyle = "black";
        gc.lineWidth = 5;
        gc.strokeText("Game Clear", SIZE * 30 + 60, SIZE * 30 + 20 + 5);
        gc.fillStyle = "gold";
        gc.fillText("Game Clear", SIZE * 30 + 60, SIZE * 30 + 20 + 5);
    } 
    
    if (isGameOver) { // GameOver
        let fontSize = SIZE * 10 + 20;
        gc.font = `bold ${fontSize}px Philosopher, sans-serif`;
        gc.textAlign = "center";
        gc.strokeStyle = "black";
        gc.lineWidth = 5;
        gc.strokeText("Game Over", SIZE * 30 + 60, SIZE * 30 + 20 + 5);
        gc.fillStyle = "red";
        gc.fillText("Game Over", SIZE * 30 + 60, SIZE * 30 + 20 + 5);
    }

    document.getElementById("result").textContent = countTotal + " ⌛" + formatTime(elapsedTime);
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
        if (countPerGame == SIZE * SIZE) perfect[totalScore] = 2; // 一筆書きはperfect
        totalScore++;
        drawCircle();
        if (totalScore == 5) { // 5連続クリアしたら
            isGameCleared = true;
            isPlaying = false;
        } else {
            nextGame();
        }
    } else if (scores.red > targetScores.red || scores.blue > targetScores.blue || scores.green > targetScores.green || !canMove() || !isColorEnough(scores)) { 
        // ターゲットスコアを超える/動けない/色が足りない場合はゲームオーバー
        isGameOver = true;
        isPlaying = false;
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

// 初期画面に戻る
function quitGame() {
    isGameOver = false;
    isGameCleared = false;
    isPlaying = false;
    playerColor = 0;
    countPerGame = 0;
    countTotal = 0;
    totalScore = 0;
    perfect = [0, 0, 0, 0, 0];
    elapsedTime = 0;
    startTime = 0;

    for (let y = 1; y <= SIZE; y++) {
        for (let x = 1; x <= SIZE; x++) {
            data[y][x] = 0;
        }
    }

    drawCircle();
    repaint();

    document.getElementById("quit").style.display = "none";
    document.getElementById("play").style.display = "block";
    document.getElementById("scores.red").textContent = "?";
    document.getElementById("scores.blue").textContent = "?";
    document.getElementById("scores.green").textContent = "?";
}

// 次の盤面へ
function nextGame() {
    playerColor = 0;
    countPerGame = 0;

    for (let y = 1; y <= SIZE; y++) {
        for (let x = 1; x <= SIZE; x++) {
            data[y][x] = 0;
        }
    }

    initializeGame();
    repaint();
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

//     totalScore = 0;
//     countPerGame = 0;
//     perfect = [0, 0, 0, 0, 0];

//     repaint();
// }

function drawCircle() {
    const ctx = document.getElementById("canvasCircle").getContext("2d");
    ctx.clearRect(0, 0, 200, 50);
    for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(20 + i*40, 25, 10, 0, Math.PI * 2);
        if (perfect[i] == 0 && !isGameOver && isPlaying) ctx.fillStyle = "white"
        else if (perfect[i] == 0) ctx.fillStyle = "#ddd";
        else if (perfect[i] == 1) ctx.fillStyle = "gold";
        else if (perfect[i] == 2) ctx.fillStyle = "#f27efc";
        ctx.fill();
        ctx.strokeStyle = "#432";
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
}

document.getElementById("quit").addEventListener("click", quitGame);
