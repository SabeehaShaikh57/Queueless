const express = require("express");
const router = express.Router();

const controller = require("../controllers/faqController");

router.get("/list", controller.listFaq);
router.post("/create", controller.createFaq);
router.post("/:id/answer", controller.answerFaq);

module.exports = router;
