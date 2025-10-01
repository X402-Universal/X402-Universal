"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExampleController = void 0;
class ExampleController {
    async getExample(req, res) {
        res.status(200).json({ message: 'This is an example response' });
    }
    async postExample(req, res) {
        const data = req.body;
        res.status(201).json({ message: 'Data received', data });
    }
}
exports.ExampleController = ExampleController;
