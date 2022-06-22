"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const app = express_1.default();
app.get('/', (request, response) => {
    return response.json({ mensage: 'e ai carinhasdasda asd ali' });
});
console.log("http://localhost:3333");
app.listen(3333);
