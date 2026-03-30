
const express = require("express");
const router = express.Router();

const controller = require("../controllers/queueController");
const { verifyAdmin, verifyToken } = require("../middleware/authMiddleware");

router.post("/join", verifyToken, controller.joinQueue);
router.get("/history", verifyToken, controller.getMyHistory);
router.post("/cancel", verifyToken, controller.cancelMyToken);
router.get("/status/:business_id", controller.getQueue);
router.post("/next", verifyAdmin, controller.nextToken);
router.post("/update-status", verifyAdmin, controller.updateTokenStatus);
router.post("/move-up", verifyAdmin, controller.moveTokenUp);

module.exports = router;
