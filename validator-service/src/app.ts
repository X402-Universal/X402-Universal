import express from 'express';
import bodyParser from 'body-parser';
import routes from './routes/index';
import { errorHandler } from './middlewares/index';

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

routes(app);

app.use(errorHandler);

export default app;