import { Response } from "express";
import * as reviewService from "./review.service";
import { AuthRequest } from "../../types";

export const getAllReviews = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const reviews = await reviewService.getUserReviews(req.user!._id.toString());
    res.status(200).json({ success: true, count: reviews.length, data: reviews });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const review = await reviewService.getReviewById(
      req.params.id as string,
      req.user!._id.toString()
    );
    res.status(200).json({ success: true, data: review });
  } catch (error: any) {
    const code = error.message === "Review not found" ? 404 : 500;
    res.status(code).json({ success: false, message: error.message });
  }
};
