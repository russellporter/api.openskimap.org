import { RequestHandler } from "express";

export const async: (fn: RequestHandler) => RequestHandler = fn => (
  req,
  res,
  next
) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
