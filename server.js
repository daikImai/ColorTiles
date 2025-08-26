const path = require("path");
const express = require("express");
const dotenv = require("dotenv");

dotenv.config(); // .env 読み込み

const app = express();
const PORT = process.env.PORT || 3000;

// JSONボディを受け取る（API用）
app.use(express.json());

// 静的ファイル配信
app.use(express.static(path.join(__dirname, "public")));



app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});
