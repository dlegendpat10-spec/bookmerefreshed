import { Response } from 'express';

export function sendSuccess(res: Response, data: any, statusCode = 200) {
  return res.status(statusCode).json({
    data,
    error: null,
  });
}

export function sendError(res: Response, errorMessage: string, statusCode = 400) {
  return res.status(statusCode).json({
    data: null,
    error: errorMessage,
  });
}
