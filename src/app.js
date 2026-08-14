const router = require("./routes");
const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const helmet = require("helmet");
const dotenv = require("dotenv");

const app = express();

dotenv.config();

app.use(morgan("dev"));
app.use(helmet());
app.use(cors());
app.use(express.json());

app.use("/api", router);

const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {
  return res.json({
    success: true,
    message: "Prophecy Verse DataSource API is live",
    version: "1.0.0",
    status: "online",
  });
});

app.listen(PORT, () => {
  console.log(`⚡️ [server] started on port ${PORT}`);
});
ভ
