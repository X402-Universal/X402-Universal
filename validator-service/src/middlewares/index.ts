import { Request, Response, NextFunction } from 'express';

export const exampleMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Middleware logic here
    next();
};

export const anotherMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Another middleware logic here
    next();
};

export const errorHandler = (err: any, req: any, res: any, next: any) => {
  console.error(err.stack);
  res.status(500).send({ error: 'Something went wrong!' });
};