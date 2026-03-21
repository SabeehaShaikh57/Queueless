
const express = require("express");
const router = express.Router();

const controller = require("../controllers/queueController");

router.post("/join",controller.joinQueue);
router.get("/status/:business_id",controller.getQueue);
router.post("/next",controller.nextToken);
router.post("/update-status",controller.updateTokenStatus);
router.post("/move-up",controller.moveTokenUp);

module.exports = router;
