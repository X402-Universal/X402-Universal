import { Router, Express, Request, Response } from 'express';

const router = Router();

router.get('/health', (req, res) => {
  res.status(200).send({ status: 'OK' });
});

router.get('/hello', (req: Request, res: Response) => {
  res.send('Hello, World!');
});

export default (app: Express) => {
  // Define your routes here
  // Example: app.use('/api/example', exampleController);
  
  app.use('/api', router);
};