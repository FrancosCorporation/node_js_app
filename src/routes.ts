import { CreateUsersController } from './controllers/CreateUsersController'
import { Router } from 'express';
const router = Router();

const createUsersController =  new CreateUsersController();

router.post("/users", createUsersController.handle);

export { router };