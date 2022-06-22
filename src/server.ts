import express, { NextFunction, Request, Response } from "express";
import './database/index'
import 'express-async-errors'
import { router } from './routes'


const server = express();
server.use(express.json());
server.use(router);

server.use((err: Error, request: Request, response: Response, next: NextFunction) => {

    if (err instanceof Error) {
        return response.status(400).json({ err: err.message, })
    }
    return response.status(500).json({
        status: "error",
        message: "Internal Server Error",
    });
});

server.listen(process.env.SERVER_PORT, () => console.log('http://localhost:' + process.env.SERVER_PORT + "/"));