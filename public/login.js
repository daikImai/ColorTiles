"use strict";

document.addEventListener("DOMContentLoaded", async () => {
    const user = await fetchUser();
    if (user.id > 0) {
        window.location.href = "/play"; // すでにログイン済みなら自動的に /play に移動
    }

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
            if (data.success) {
                window.location.href = "/play"; // ログイン成功 → ゲーム画面へ
            } else {
                alert(data.error || "Login failed");
            }
        } catch (err) {
            console.error(err);
            alert("Server error");
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
            if (data.success) {
                window.location.href = "/play"; 
            } else {
                alert(data.error || "Register failed");
            }
        } catch (err) {
            console.error(err);
            alert("Server error");
        }
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
