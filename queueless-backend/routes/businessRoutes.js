
const express = require("express");
const router = express.Router();

const controller = require("../controllers/businessController");

router.post("/create",controller.createBusiness);
router.get("/list",controller.getBusinesses);
router.delete("/:id",controller.deleteBusiness);

module.exports = router;
