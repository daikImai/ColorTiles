"use strict";

let drawLine1 = null;
let drawLine2 = null;

document.addEventListener("DOMContentLoaded", async () => {
    const user = await fetchUser();
    if (user.id > 0) {
        window.location.href = "/play"; // すでにログイン済みなら自動的に /play に移動
    }
    
    drawLine1 = document.getElementById("canvas1").getContext("2d");
    drawLine2 = document.getElementById("canvas2").getContext("2d");
    drawLine(drawLine1);
    drawLine(drawLine2);


    // CSRFトークンを取得
    const csrfRes = await fetch("/api/csrf-token");
    const csrfData = await csrfRes.json();
    const csrfToken = csrfData.csrfToken;

    // Login Form
    const loginForm = document.getElementById("loginForm");
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(loginForm);
        const body = Object.fromEntries(formData.entries());

        try {
            const res = await fetch("/api/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-Token": csrfToken
                },
                body: JSON.stringify(body)
            });

            const data = await res.json();
            if (data.ok) {
                alert("Login Successful!\nUsername: " + body.username);
                window.location.href = "/play"; // ログイン成功 → ゲーム画面へ
            } else {
                alert("Login Failed");
            }
        } catch (err) {
            console.error(err);
            alert("Server Error");
        }
    });

    // Register Form
    const registerForm = document.getElementById("registerForm");
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(registerForm);
        const body = Object.fromEntries(formData.entries());

        try {
            const res = await fetch("/api/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-Token": csrfToken
                },
                body: JSON.stringify(body)
            });

            const data = await res.json();
            if (data.ok) {
                alert("Registration Successful!\nUsername: " + body.username);
                window.location.href = "/play"; 
            } else {
                alert(data.error || "Register Failed");
            }
        } catch (err) {
            console.error(err);
            alert("Server Error");
        }
    });

    // Test Play Without Login
    document.getElementById("test-play").addEventListener("click", () => {
        window.location.href = "/play";
    });

});

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
    return data.user || { id: 0, username: 'unknown' };
    } catch (err) {
        console.error(err);
    }
}

// ORの表示キャンバス
function drawLine(drawLine) { 
    drawLine.strokeStyle = "#13325d";
    drawLine.beginPath();
    drawLine.moveTo(0, 10);
    drawLine.lineTo(390, 10);
    drawLine.stroke();
}
