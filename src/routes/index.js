const express = require("express");

const auth = require("./auth.route");

const authMiddleware = require("../middleware/auth.middleware");
const errorMiddleware = require("../middleware/error.middleware");
const notFoundMiddleware = require("../middleware/not-found.middleware");

const samehadaku = require("./samehadaku.route");

const bookmark = require("./bookmark.route");
const providerRouter = require("./provider.route");

const router = express();

router.use(auth);

// Public health/test endpoint
router.get("/test", (req, res) => {
  return res.json({
    success: true,
    message: "Prophecy Verse DataSource API is working",
    timestamp: new Date().toISOString(),
  });
});

// Public API routes: no Authorization token is required.
router.use("/samehadaku", samehadaku);
router.use(providerRouter);

// Bookmark operations are user-specific and remain protected by JWT.
router.use(authMiddleware);
router.use(bookmark);

router.use(errorMiddleware);
router.use(notFoundMiddleware);

module.exports = router;
