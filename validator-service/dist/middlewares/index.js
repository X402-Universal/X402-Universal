"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.anotherMiddleware = exports.exampleMiddleware = void 0;
const exampleMiddleware = (req, res, next) => {
    // Middleware logic here
    next();
};
exports.exampleMiddleware = exampleMiddleware;
const anotherMiddleware = (req, res, next) => {
    // Another middleware logic here
    next();
};
exports.anotherMiddleware = anotherMiddleware;
const errorHandler = (err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send({ error: 'Something went wrong!' });
};
exports.errorHandler = errorHandler;
