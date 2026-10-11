import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { CreateUsersController } from "./controllers/CreateUsersController";
import { SessionsController } from "./controllers/SessionsController";
import { ShowProfileController } from "./controllers/ShowProfileController";
import { ensureAuthenticated } from "./middlewares/ensureAuthenticated";

export function createRouter(jwtSecret: string): Router {
  const router = Router();
  const createUsersController = new CreateUsersController();
  const sessionsController = new SessionsController(jwtSecret);
  const showProfileController = new ShowProfileController();
  const signupLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error:
        "Muitas tentativas de cadastro. Tente novamente em alguns minutos.",
    },
  });
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: "Muitas tentativas de login. Tente novamente em alguns minutos.",
    },
  });

  router.post("/users", signupLimiter, createUsersController.handle);
  router.post(
    "/sessions",
    loginLimiter,
    sessionsController.handle.bind(sessionsController),
  );
  router.get(
    "/users/me",
    ensureAuthenticated(jwtSecret),
    showProfileController.handle,
  );

  return router;
}
