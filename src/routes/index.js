const express = require("express");
const auth = require("./auth.route");
const authMiddleware = require("../middleware/auth.middleware");
const errorMiddleware = require("../middleware/error.middleware");
const notFoundMiddleware = require("../middleware/not-found.middleware");
const samehadaku = require("./samehadaku.route");
const bookmark = require("./bookmark.route");
const providerRouter = require("./provider.route");

const router = express();

// Public authentication routes
router.use(auth);

// Public anime-data, streaming, and provider routes
// Authorization token is not required for these routes.
router.use("/samehadaku", samehadaku);
router.use(providerRouter);

// User-specific routes remain protected by JWT.
router.use(authMiddleware);
router.use(bookmark);

// Existing error and 404 middleware
router.use(errorMiddleware);
router.use(notFoundMiddleware);

module.exports = router;
