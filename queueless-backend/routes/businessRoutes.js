
const express = require("express");
const router = express.Router();

const controller = require("../controllers/businessController");
const { verifyAdmin } = require("../middleware/authMiddleware");

router.post("/create", verifyAdmin, controller.createBusiness);
router.get("/list", controller.getBusinesses);
router.delete("/:id", verifyAdmin, controller.deleteBusiness);

module.exports = router;
