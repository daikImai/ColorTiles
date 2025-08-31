"use strict";

const data = [];
const MIN_SIZE = 4;
const MAX_SIZE = 6;

const decBtn = document.getElementById("dec");
const incBtn = document.getElementById("inc");

let currentUserId = null;
let currentUsername = "unknown";
let SIZE = 5;
let board = null;
let gc = null;
let startX, startY;
let initialPx, initialPy;
let px, py;
let playerColor = 0; // 0: none, 1: red, 2: blue, 3: green
let initialColorPoints = [];
let colorPoints = [11, 22, 33]; // 11: red, 22: blue, 33: green
let targetScores = { red: 0, blue: 0, green: 0 };
let isModalOpen = false;
let isHidden = false;
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

async function fetchUser() {
    try {
        const res = await fetch('/api/me', {
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'same-origin', // セッション cookie を送信
        });
        if (!res.ok) throw new Error('unauthenticated');
        const data = await res.json();
        currentUserId = data.user.id;
        currentUsername = data.user.username;
        console.log('Login User:', currentUserId, currentUsername);
    } catch (err) {
        console.error(err);
        alert('Invalid session. Redirecting to home page.');
        window.location.href = '/';
    }
}

function getRandomEmptyPosition() {
    let x, y;
    do {
        x = Math.floor(Math.random() * SIZE) + 1;
        y = Math.floor(Math.random() * SIZE) + 1;
    } while (data[y][x] != 0);
    return { x, y };
}

document.addEventListener("DOMContentLoaded", () => {
    fetchUser(); // ログインユーザー情報を取得

    board = document.getElementById("canvas5");
    gc = board.getContext("2d");
    for (let y = 0; y < SIZE + 2; y++) {
        let row = [];
        for (let x = 0; x < SIZE + 2; x++) {
            row.push(x === 0 || x === SIZE + 1 || y === 0 || y === SIZE + 1 ? 6 : 0); //sentinel
        }
        data.push(row);
    }

    repaint();
    
    document.getElementById("play").addEventListener("click", startGame);
    document.getElementById("quit").addEventListener("click", quitGame);

    document.addEventListener("keydown", (e) => {
        if (e.code != "Space" || isModalOpen) return;

        if (isGameOver || isGameCleared) {
            quitGame(); // スペースキーでquit
        } else if (!isPlaying) {
            startGame(); // スペースキーでstart
            window.addEventListener("keydown", mykeydown);
        }
    });

    // 非表示ボタン
    document.getElementById("toggleResult").addEventListener("click", () => {
        if (!isHidden) { // 非表示にする
            document.getElementById("toggleResult").innerHTML = '<i class="fa-solid fa-eye-slash"></i>'; // 斜線付き
            document.getElementById("result").innerHTML = '- <i class="fa-solid fa-hourglass-half"></i> -- : --';
        } else { // 表示する
            document.getElementById("toggleResult").innerHTML = '<i class="fa-solid fa-eye"></i>'; // 斜線なし
            document.getElementById("result").innerHTML = countTotal + ' <i class="fa-solid fa-hourglass-half"></i> ' + formatTime(elapsedTime);
        }
        isHidden = !isHidden;
    });

    // マイページ
    myPageButton.addEventListener("click", async () => {
        isModalOpen = true;
        myPageModal.style.visibility = "visible";
        mask1.style.visibility = "visible";
        myPageModal.animate(showListKeyframes, options);
        mask1.animate(showListKeyframes, options);

        if (currentUserId != 0) { // ログイン状態であれば
            try {
                const res = await fetch('/api/user-stats', { credentials: 'same-origin' });
                if (!res.ok) throw new Error('Failed to fetch stats');
                const data = await res.json();

                document.getElementById('show-username').textContent = `${currentUsername}`; // ユーザーネーム表示
                const stats = document.getElementById('stats');

                function renderBoardSize(boardSize) {
                    const best = data.bestScore.find(r => r.board_size === boardSize) || {};
                    const bestWeek = data.bestWeekScore.find(r => r.board_size === boardSize) || {};
                    const perfectTotal = data.perfectTotal.find(r => r.board_size === boardSize)?.perfect_total || 0;
                    const perfectPerGame = data.perfectPerGame.find(r => r.board_size === boardSize)?.perfect_per_game || 0;

                    let bestDisplay = `Count: ${best.count || '--'} / Time: ${best.time != null ? formatTime(best.time) : '--:--'}`;
                    let bestWeekDisplay = `Count: ${bestWeek.count || '--'} / Time: ${bestWeek.time != null ? formatTime(bestWeek.time) : '--:--'}`;

                    // 新記録なら "new" を追加
                    if (isGameCleared) {
                        if (best.count == countTotal && best.time == elapsedTime) bestDisplay += '<span class="new">new</span>';
                        if (bestWeek.count == countTotal && bestWeek.time == elapsedTime) bestWeekDisplay += '<span class="new">new</span>';
                    }

                    stats.innerHTML = `
                        <li>Best Score (All Time): </li>
                        <span class="result-holder wrapper">${bestDisplay}</span>
                        <li>Best Score (This Week): </li>
                        <span class="result-holder wrapper">${bestWeekDisplay}</span>
                        <li>Max Perfect Per Game: ${perfectPerGame}</li>
                        <li>Perfect Total: ${perfectTotal}</li>
                    `;
                }

                // タブクリック時に切り替え
                document.querySelectorAll('.stats-tabs th').forEach(tab => {
                    tab.addEventListener('click', () => {
                        // まず全タブから tab-selected クラスを削除
                        document.querySelectorAll('.stats-tabs th').forEach(t => t.classList.remove('tab-selected'));
                        // クリックされたタブに追加
                        tab.classList.add('tab-selected');
                        // 実際の切り替え処理
                        renderBoardSize(Number(tab.dataset.size));
                    });
                });

                // 初期表示はその時点でのboardSize
                document.querySelectorAll('.stats-tabs th[data-size]').forEach(th => {
                    if (th.dataset.size == SIZE) {
                        th.classList.add('tab-selected');
                    } else {
                        th.classList.remove('tab-selected');
                    }
                }); 
                renderBoardSize(SIZE);

                // ログアウト処理
                document.getElementById('log-out').addEventListener('click', async (e) => {
                    e.preventDefault();
                    try {
                        // CSRFトークンを取得
                        const csrfRes = await fetch("/api/csrf-token");
                        const csrfData = await csrfRes.json();
                        const csrfToken = csrfData.csrfToken;

                        const res = await fetch('/api/logout', {
                            method: 'POST',
                            headers: { 
                                'Content-Type': 'application/json',
                                'CSRF-Token': csrfToken
                            }
                        });
                        const data = await res.json();
                        if (data.ok) {
                            window.location.href = '/'; // ログアウト成功 → トップページに戻す
                            alert('Logout Successful!');
                        } else {
                            alert('Logout Failed');
                        }
                    } catch (err) {
                        console.error('logout error:', err);
                        alert('Server Error');
                    }
                });
            } catch(err) {
                console.error(err);
            }
        } else { // 未ログイン状態であれば
            document.getElementById('show-username').style.display = 'none'; 
            document.getElementById('stats-container').style.display = 'none'; 
            document.getElementById('if-not-loggedin').style.display = 'block'; 
            document.getElementById('log-out').textContent = 'Log In >>'
            document.getElementById('log-out').addEventListener('click', async () => {
                window.location.href = '/';
            });
        }
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
            isModalOpen = false;
        };
    });

    // マイページのマスク
    mask1.addEventListener("click", () => {
        closeMyPageButton.dispatchEvent(new PointerEvent("click"));
    });

    // 遊び方
    howToPlayButton.addEventListener("click", async () => {
        isModalOpen = true;
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
            isModalOpen = false;
        };
    });

    // 遊び方のマスク
    mask2.addEventListener("click", () => {
        closeHowToPlayButton.dispatchEvent(new PointerEvent("click"));
    });

    // ランキング
    rankingButton.addEventListener("click", async () => {
        isModalOpen = true;
        rankingModal.style.visibility = "visible";
        mask3.style.visibility = "visible";
        rankingModal.animate(showListKeyframes, options);
        mask3.animate(showListKeyframes, options);

        try {
            const res = await fetch('/api/get-ranking', { credentials: 'same-origin' });
            if (!res.ok) throw new Error('Failed to fetch ranking');
            const data = await res.json();
            // console.log(data);

            let thisWeek = data.thisWeek; // 週間ランキング
            const weekStart = new Date();
            weekStart.setHours(0, 0, 0, 0);
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);
            let allTime = data.allTime; // 累計ランキング
            let currentBoardSize = SIZE;
            let currentDataset = "thisWeek";

            const ranking = document.getElementById('ranking');
            const reloadButton = document.getElementById('reload');
            const toAllTimeButton = document.getElementById("toAllTime");
            const toWeeklyButton = document.getElementById("toWeekly");

            function renderRanking(boardSize, dataset) {
                if (dataset == thisWeek) document.getElementById("ranking-title").textContent = `Weekly (${formatDate(weekStart)} - ${formatDate(weekEnd)})`;
                else if (dataset == allTime) document.getElementById("ranking-title").textContent = `All Time`;
                ranking.innerHTML = "";
                const filtered = dataset.filter(r => r.board_size === boardSize);

                for (let i = 0; i < 5; i++) {
                    const player = filtered[i] || { username: "-", count: boardSize>4 ? "---" : "--", time: null };

                    const rankDiv = document.createElement("div");
                    rankDiv.classList.add("ranking-holder");

                    // 1位〜3位は特別クラスを付与
                    if (i == 0) rankDiv.classList.add("first");
                    if (i == 1) rankDiv.classList.add("second");
                    if (i == 2) rankDiv.classList.add("third");

                    const rank = document.createElement("span");
                    rank.classList.add("rank");
                    rank.textContent = i + 1;

                    const resultDiv = document.createElement("div");
                    if (i == 0) resultDiv.classList.add("margin-left");

                    const nameSpan = document.createElement("span");
                    nameSpan.textContent = player.username;

                    // new判定
                    if (isGameCleared && player.username == currentUsername && player.count == countTotal && player.time == elapsedTime) {
                        const newBadge = document.createElement("span");
                        newBadge.textContent = "new";
                        newBadge.classList.add("new");
                        nameSpan.appendChild(newBadge);
                    }

                    const resultSpan = document.createElement("span");
                    resultSpan.textContent = `Count: ${player.count} / Time: ${player.time != null ? formatTime(player.time) : "--:--"}`;

                    resultDiv.appendChild(nameSpan);
                    resultDiv.appendChild(document.createElement("br"));
                    resultDiv.appendChild(resultSpan);

                    rankDiv.appendChild(rank);
                    rankDiv.appendChild(resultDiv);

                    ranking.appendChild(rankDiv);

                    // ポップアップアニメーション
                    requestAnimationFrame(() => {
                        const holders = ranking.querySelectorAll(".ranking-holder");
                        holders.forEach((el, idx) => {
                            setTimeout(() => {
                            el.classList.add("pop");
                            setTimeout(() => el.classList.remove("pop"), 100); // 戻す
                            }, idx * 70); // 遅れ
                        });
                    });
                }
            }

            // タブクリック時に切り替え
            document.querySelectorAll('.ranking-tabs th').forEach(tab => {
                tab.addEventListener('click', () => {
                    document.querySelectorAll('.ranking-tabs th').forEach(t => t.classList.remove('tab-selected'));
                    tab.classList.add('tab-selected');
                    currentBoardSize = Number(tab.dataset.size);
                    if (currentDataset == "thisWeek") renderRanking(currentBoardSize, thisWeek);
                    else if (currentDataset == "allTime") renderRanking(currentBoardSize, allTime);
                });
            });

            // リロードボタン
            reloadButton.addEventListener('click', async () => {
                try {
                    reloadButton.disabled = true; // リロード中はボタンを無効化
                    
                    const res = await fetch('/api/get-ranking', { credentials: 'same-origin' });
                    if (!res.ok) throw new Error('Failed to fetch ranking');
                    const data = await res.json();

                    // 更新されたデータに置き換え
                    allTime = data.allTime;
                    thisWeek = data.thisWeek;
                    if (currentDataset == "thisWeek") renderRanking(currentBoardSize, thisWeek);
                    else if (currentDataset == "allTime") renderRanking(currentBoardSize, allTime);
                } catch(err) {
                    console.error(err);
                } finally {
                    reloadButton.disabled = false; // ボタンを再度有効化
                }
            });

            // 累計ランキングへ
            toAllTimeButton.addEventListener('click', () => {
                toAllTimeButton.style.display = "none";
                toWeeklyButton.style.display = "block";
                currentDataset = "allTime";
                renderRanking(currentBoardSize, allTime);
            })

            // 週間ランキングへ
            toWeeklyButton.addEventListener('click', () => {
                toWeeklyButton.style.display = "none";
                toAllTimeButton.style.display = "block";
                currentDataset = "thisWeek";
                renderRanking(currentBoardSize, thisWeek);
            })

            // 初期表示はその時点でのboardSizeかつ週間ランキング
            document.querySelectorAll('.ranking-tabs th[data-size]').forEach(th => {
                if (th.dataset.size == SIZE) {
                    th.classList.add('tab-selected');
                } else {
                    th.classList.remove('tab-selected');
                }
            }); 
            toWeeklyButton.style.display = "none";
            toAllTimeButton.style.display = "block";
            renderRanking(SIZE, thisWeek);

        } catch(err) {
            console.error(err);
        }
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
            isModalOpen = false;
        };
    });

    // ランキングのマスク
    mask3.addEventListener("click", () => {
        closeRankingButton.dispatchEvent(new PointerEvent("click"));
    });

    // 盤面のサイズを1小さく
    decBtn.addEventListener("click", () => {
        if (SIZE > 4) switchSize(SIZE - 1);
    });

    // 盤面のサイズを1大きく
    incBtn.addEventListener("click", () => {
        if (SIZE < 6) switchSize(SIZE + 1);
    });

    // '<'と'>'でも
    window.addEventListener("keydown", (e) => {
        if (isPlaying || isGameOver || isGameCleared || isModalOpen) return;
        if (e.keyCode == 37 && SIZE > 4) switchSize(SIZE - 1);
        else if (e.keyCode == 39 && SIZE < 6) switchSize(SIZE + 1);
    });

    // スワイプ操作
    document.addEventListener("touchstart", function(e) {
        if (!isPlaying || isGameOver || isGameCleared) return;
        if (e.touches.length > 1) return; // マルチタッチは無視
        if (!board.contains(e.target)) return; // board内のスワイプのみ
        e.preventDefault();

        const touchX = e.touches[0].clientX;
        const touchY = e.touches[0].clientY;

        startX = touchX;
        startY = touchY;
    }, { passive: false });
    document.addEventListener("touchend", function(e) {
        if (!isPlaying || isGameOver || isGameCleared) return;
        if (!board.contains(e.target)) return;
        e.preventDefault();

        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;

        const dx = endX - startX;
        const dy = endY - startY;
        const threshold = 30; // 最小スワイプ距離
        let keyCode = null;

        if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > threshold) keyCode = 39; // right
            else if (dx < -threshold) keyCode = 37; // left
        } else {
            if (dy > threshold) keyCode = 40; // down
            else if (dy < -threshold) keyCode = 38; // up
        }

        if (keyCode) {
            mykeydown({ keyCode });
        }
    }, { passive: false });
});

function switchSize(newSize) {
    SIZE = newSize;

    // dataを新しいサイズに初期化
    data.length = 0; // 既存のdataをクリア
    for (let y = 0; y < SIZE + 2; y++) {
        let row = [];
        for (let x = 0; x < SIZE + 2; x++) {
            row.push(x === 0 || x === SIZE + 1 || y === 0 || y === SIZE + 1 ? 6 : 0);
        }
        data.push(row);
    }

    // キャンバスを切り替え
    document.getElementById("canvas4").style.display = SIZE === 4 ? "block" : "none";
    document.getElementById("canvas5").style.display = SIZE === 5 ? "block" : "none";
    document.getElementById("canvas6").style.display = SIZE === 6 ? "block" : "none";

    // それ以上リサイズできない場合はボタンを無効化
    if (SIZE <= MIN_SIZE) {
        decBtn.classList.add("disabled");
    } else {
        decBtn.classList.remove("disabled");
    }

    if (SIZE >= MAX_SIZE) {
        incBtn.classList.add("disabled");
    } else {
        incBtn.classList.remove("disabled");
    }

    board = document.getElementById("canvas" + SIZE);
    gc = board.getContext("2d");
    document.getElementById("play").textContent = "Play " + SIZE + "×" + SIZE;

    repaint();
}

function getColorFromValue(value) {
    switch (value) {
        case colorPoints[0]: return 'red';
        case colorPoints[1]: return 'blue';
        case colorPoints[2]: return 'green';
        default: return null;
    }
}

// 盤面がクリア可能かチェック
function isValidPosition(initialColorPoints, targetScores) {
    // 四つ角チェック
    const corners = [ 
        [[1,1],[1,2],[2,1]],
        [[1,SIZE],[1,SIZE-1],[2,SIZE]],
        [[SIZE,1],[SIZE-1,1],[SIZE,2]],
        [[SIZE,SIZE],[SIZE-1,SIZE],[SIZE,SIZE-1]],
    ];

    for (const corner of corners) {
        if (corner.every(([y,x]) => data[y][x] != 0)) {
            const cornerColor = getColorFromValue(data[corner[0][0]][corner[0][1]]);
            if (cornerColor && targetScores[cornerColor] > 1) { // 角の色が2以上必要
                return false; // クリア不可能
            }
        }
    }

    // 距離チェック
    let isImpossibleCount = 0;
    for (let i = 0; i < colorPoints.length; i++) {
        let color = getColorFromValue(colorPoints[i]);
        let tooFarCount = 0;

        for (let j = 0; j < colorPoints.length; j++) {
            if (i === j) continue; // 同じ色は無視
            const minDist = Math.abs(initialColorPoints[i].x - initialColorPoints[j].x) +
                         Math.abs(initialColorPoints[i].y - initialColorPoints[j].y);

            if (targetScores[color] < minDist) tooFarCount++; // 遠くて届かない
        }

        if (tooFarCount == colorPoints.length-1) isImpossibleCount++; // 他の色すべてに届かない
    }

    if (isImpossibleCount >= 2) return false; // ある2色から届かない場合、クリア不可能

    return true; // クリア可能
}

function initializeGame() {
    setTargetScores();
    do {
        initialColorPoints = [];
        for (let i = 0; i < colorPoints.length; i++) {
            let { x, y } = getRandomEmptyPosition();
            data[y][x] = colorPoints[i];
            initialColorPoints.push({ x, y, value: colorPoints[i] });
        }
    } while (!isValidPosition(initialColorPoints, targetScores));

    ({ x: px, y: py } = getRandomEmptyPosition());
    initialPx = px;
    initialPy = py;
}

function startGame() {
    if (!isPlaying && !isGameOver && !isGameCleared) {
        isPlaying = true;
        startTime = Date.now();
        initializeGame();
        document.getElementById("play").style.display = "none";
        document.getElementById("inc").style.display = "none";
        document.getElementById("dec").style.display = "none";
        document.getElementById("quit").style.display = "block"; 
        requestAnimationFrame(loop);
    }
}

function loop() {
    if (isPlaying && !isGameOver && !isGameCleared) {
        elapsedTime = (Date.now() - startTime) / 1000; // x.xxx 秒
    }
    repaint();

    // ゲームが終わるまではループ
    if (isPlaying && !isGameOver && !isGameCleared) {
        requestAnimationFrame(loop);
    }
}

function formatTime(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    const mm = String(min).padStart(2, '0');
    const ss = String(sec).padStart(2, '0');
    return `${mm}:${ss}`;
}

function formatDate(date) {
    const m = String(date.getMonth() + 1);
    const d = String(date.getDate());
    return `${m}/${d}`;
}

function setTargetScores() {
    let remainingScore = SIZE * SIZE - colorPoints.length;
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

    if (!isHidden) document.getElementById("result").innerHTML = countTotal + ' <i class="fa-solid fa-hourglass-half"></i> ' + formatTime(elapsedTime);
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
            document.getElementById("quit").textContent = "Back";
            saveResult(countTotal, elapsedTime, SIZE, perfect); // クリア時に結果を保存
        } else {
            nextGame();
        }
    } else if (scores.red > targetScores.red || scores.blue > targetScores.blue || scores.green > targetScores.green || !canMove() || !isColorEnough(scores)) { 
        // ターゲットスコアを超える/動けない/色が足りない場合はゲームオーバー
        isGameOver = true;
        isPlaying = false;
    }
}

// 結果保存
async function saveResult(count, time, boardSize, perfect) {
    try {
        // CSRFトークンを取得
        const csrfRes = await fetch("/api/csrf-token");
        const csrfData = await csrfRes.json();
        const csrfToken = csrfData.csrfToken;

        const res = await fetch('/api/save-result', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            credentials: 'same-origin',
            body: JSON.stringify({ count, time, boardSize, perfect }),
        });
        const data = await res.json();
        if (!data.ok) {
            console.error('DB error:', data.message);
        } else {
            console.log('DB updated success!');
        }
    } catch (err) {
        console.error('DB error:', err);
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
    document.getElementById("quit").textContent = "Quit";
    document.getElementById("play").style.display = "block";
    document.getElementById("inc").style.display = "block";
    document.getElementById("dec").style.display = "block";
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
