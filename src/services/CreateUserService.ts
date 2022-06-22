const mongoose = require('mongoose');

const Schema = mongoose.Schema;

import { User } from '../models/User'
import { v4 as uuid } from 'uuid';

interface IUserRequest {
    name: String,
    email: String,
    password: String,
}

class CreateUserService {
    async execute({ name, email, password }: IUserRequest) {
        const user = await User.create({ name, email, password });
        return user;
    }
}
export { CreateUserService }