const express = require("express");
const router = express.Router();

const controller = require("../controllers/faqController");
const { verifyAdmin } = require("../middleware/authMiddleware");

router.get("/list", controller.listFaq);
router.post("/create", controller.createFaq);
router.post("/:id/answer", verifyAdmin, controller.answerFaq);

module.exports = router;
