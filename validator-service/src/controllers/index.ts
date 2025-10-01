import { Request, Response } from 'express';

export class ExampleController {
    public async getExample(req: Request, res: Response): Promise<void> {
        res.status(200).json({ message: 'This is an example response' });
    }

    public async postExample(req: Request, res: Response): Promise<void> {
        const data = req.body;
        res.status(201).json({ message: 'Data received', data });
    }
}