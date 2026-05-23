import { Router } from "express";
import * as reviewController from "./review.controller";
import { protect } from "../../middlewares/auth";

const router = Router();
router.use(protect);

router.get("/", reviewController.getAllReviews);
router.get("/:id", reviewController.getReview);

export default router;
