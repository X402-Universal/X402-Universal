"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
exports.default = (app) => {
    // Define your routes here
    // Example: app.use('/api/example', exampleController);
    app.use('/api', router);
};
