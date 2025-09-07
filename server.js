require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const csurf = require('csurf');

const app = express();

const PORT = process.env.PORT;
const SESSION_SECRET = process.env.SESSION_SECRET;
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS, 10);

/** --- DB プール --- **/
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_ENV == 'render' ? { rejectUnauthorized: false } : false
});

/** --- 基本ミドルウェア --- **/
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.set('trust proxy', 1);

/** --- セッション --- **
 *  - connect-pg-simple に pg Pool を渡してセッションを DB に保存
 */
app.use(session({
  store: new PgSession({
    pool: pool,
    tableName: 'session',
    createTableIfMissing: true // connect-pg-simple が自動でテーブル作る（true に依存）
  }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: true, // CSRFトークンをログイン前に使いたい場合は true
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV == 'production', // 本番は HTTPS で true に
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 1日
  }
}));

/** --- CSRF --- **
 * フロントは /api/csrf-token でトークンを取得して、POST時にヘッダ X-CSRF-Token に入れる
 */
app.use(csurf());

/** --- レート制限 --- **/
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分
  max: 10,
  message: { error: 'Too many attempts, try again later.' }
});

/** --- 静的ファイル --- **/
app.use(express.static(path.join(__dirname, 'public'))); 

// ログイン画面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ゲーム画面
app.get('/play', (req, res) => {
  // ゲーム画面 play.html を返す
  res.sendFile(path.join(__dirname, 'public', 'play.html'));
});

/** --- ユーティリティ / ミドルウェア --- **/
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'unauthenticated' });
  }
  next();
}

/** --- API: CSRF token 取得 --- **/
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

/** --- API: ログイン --- **/
app.post('/api/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'missing credentials' });

    const q = await pool.query('SELECT id, username, password_hash FROM users WHERE username = $1', [username]);
    if (q.rowCount === 0) return res.status(401).json({ error: 'invalid credentials' });

    const user = q.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });

    // 認証成功 → セッションへ
    req.session.userId = user.id;
    req.session.username = user.username;

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

/** --- API: ユーザー登録 --- **/
app.post('/api/register', authLimiter, async (req, res) => {
  try {
    const { username, password, passwordConfirm } = req.body || {};

    // 入力必須
    if (!username || !password || !passwordConfirm) {
      return res.status(400).json({ error: 'All fields must be filled out.' });
    } else if (username.length > 10) { // usernameは10文字以下
      return res.status(422).json({ error: 'username must be shorter than 10 letters.' });
    } else if (password.length < 6) { // passwordは6文字以上
      return res.status(422).json({ error: 'password must be longer than 6 letters.' });
    } else if (password != passwordConfirm) { // パスワード一致確認
      return res.status(422).json({ error: 'Passwords do not match.' });
    }

    // ユーザー名は重複不可
    const r = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (r.rowCount > 0) return res.status(409).json({ error: 'username already exists.' });

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const q = await pool.query(`INSERT INTO users (username, password_hash) 
      VALUES($1, $2) RETURNING id, username`, [username, hash]);

    const user = q.rows[0];
    req.session.userId = user.id;
    req.session.username = user.username;

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

/** --- API: ログアウト --- **/
app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('session destroy err', err);
      return res.status(500).json({ error: 'logout error' });
    }
    // ブラウザ側 cookie を消す
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

/** --- API: ユーザ情報取得 --- **/
app.get('/api/me', async (req, res) => {
  const id = req.session.userId;
  // if (!id) return res.status(401).json({ error: 'invalid session' });
  const q = await pool.query('SELECT id, username FROM users WHERE id = $1', [id]);
  if (q.rowCount === 0) return res.json({ user: { id: 0, username: 'unknown' } }); // 未ログイン
  res.json({ user: q.rows[0] });
});

/** --- API: 結果保存 --- **/
app.post('/api/save-result', async (req, res) => {
  const { count, time, boardSize, perfect } = req.body;
  if (!count || !time || !boardSize || !perfect) {
    return res.status(400).json({ ok: false, message: 'Invalid parameters' });
  }

  try {
    await pool.query('BEGIN'); // トランザクション開始

    const perfectCount = perfect.filter(p => p === 2).length; // perfect数を計算
    
    await pool.query( // resultsテーブルの更新
      `INSERT INTO results (user_id, count, time, perfect, board_size) 
       VALUES ($1, $2, $3, $4, $5)`,
      [req.session.userId, count, time, perfectCount, boardSize]
    );

    if (perfectCount > 0 && req.session.userId) { // perfect_totalテーブルの更新
      await pool.query(
        `INSERT INTO perfect_total (user_id, board_size, perfect_total)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, board_size) 
         DO UPDATE SET perfect_total = perfect_total.perfect_total + $3`,
        [req.session.userId, boardSize, perfectCount]
      );
    }

    await pool.query('COMMIT'); // トランザクション確定

    res.json({ ok: true });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('DB error:', err);
    res.status(500).json({ ok: false, message: 'DB error' });
  }
});

/** --- API: ユーザデータ取得 --- **/
app.get('/api/user-stats', requireAuth, async (req, res) => {
  const userId = req.session.userId;

  try {
    // 最大perfect_per_gameを取得
    const perfectPerGameResult = await pool.query(`
      SELECT board_size, MAX(perfect) AS perfect_per_game
      FROM results
      WHERE user_id = $1
      GROUP BY board_size
    `, [userId]);

    // perfect_totalを取得
    const perfectTotalResult = await pool.query(`
      SELECT board_size, perfect_total
      FROM perfect_total
      WHERE user_id = $1
    `, [userId]);

    // 最良スコア（全期間）
    const bestScoreResult = await pool.query(`
      SELECT DISTINCT ON (board_size) board_size, count, time
      FROM results
      WHERE user_id = $1
      ORDER BY board_size, count ASC, time ASC
    `, [userId]);

    // 最良スコア（今週）
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // 今週日曜の0時(JST)
    // weekStart.setDate(weekStart.getDate() - (weekStart.getDay() == 0 ? 6 : weekStart.getDay() - 1)); // 今週月曜の0時(JST)
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const bestWeekScoreResult = await pool.query(`
      SELECT DISTINCT ON (board_size) board_size, count, time
      FROM results
      WHERE user_id = $1 
      AND (created_at AT TIME ZONE 'Asia/Tokyo') >= $2
      AND (created_at AT TIME ZONE 'Asia/Tokyo') < $3
      ORDER BY board_size, count ASC, time ASC
    `, [userId, weekStart, weekEnd]);

    res.json({
      perfectPerGame: perfectPerGameResult.rows, 
      perfectTotal: perfectTotalResult.rows,
      bestScore: bestScoreResult.rows,
      bestWeekScore: bestWeekScoreResult.rows
    });

  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

/** --- API: ランキング取得 --- **/
app.get('/api/get-ranking', async (req, res) => {
  try {
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // 今週日曜の0時(JST)
    // weekStart.setDate(weekStart.getDate() - (weekStart.getDay() == 0 ? 6 : weekStart.getDay() - 1)); // 今週月曜の0時(JST)
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    // 累計ランキング
    const allTimeResult = await pool.query(`
      SELECT board_size, username, count, time
      FROM (
        SELECT 
          r.board_size,
          COALESCE(u.username, 'unknown') AS username,
          r.count,
          r.time,
          ROW_NUMBER() OVER (
            PARTITION BY r.board_size
            ORDER BY r.count ASC, r.time ASC
          ) AS rn
        FROM results r
        LEFT JOIN users u ON r.user_id = u.id
      ) ranked
      WHERE rn <= 5; -- top 5
    `);

    // 週間ランキング
    const weekResult = await pool.query(`
      SELECT board_size, username, count, time
      FROM (
        SELECT 
          r.board_size,
          COALESCE(u.username, 'unknown') AS username,
          r.count,
          r.time,
          ROW_NUMBER() OVER (
            PARTITION BY r.board_size
            ORDER BY r.count ASC, r.time ASC
          ) AS rn
        FROM results r
        LEFT JOIN users u ON r.user_id = u.id
        WHERE (r.created_at AT TIME ZONE 'Asia/Tokyo') >= $1 
        AND (r.created_at AT TIME ZONE 'Asia/Tokyo') < $2
      ) ranked
      WHERE rn <= 5; -- top 5
    `, [weekStart, weekEnd]);

    res.json({
      allTime: allTimeResult.rows,
      thisWeek: weekResult.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});


/** --- エラーハンドリング --- **/
app.use((err, _req, res, _next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ error: 'invalid csrf token' });
  }
  console.error(err);
  res.status(500).json({ error: 'server error' });
});

/** --- サーバ起動 --- **/
app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});
