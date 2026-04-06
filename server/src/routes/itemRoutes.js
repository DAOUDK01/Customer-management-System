const express = require("express");
const {
  listItems,
  createItem,
  updateItem,
  deleteItem,
} = require("../controllers/itemController");
const { verifyToken, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(verifyToken);

router.get("/", requireRole("admin", "manager"), listItems);
router.post("/", requireRole("admin", "manager"), createItem);
router.patch("/:id", requireRole("admin", "manager"), updateItem);
router.delete("/:id", requireRole("admin", "manager"), deleteItem);

module.exports = router;
