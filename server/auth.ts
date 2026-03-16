import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  if (!hashed || !salt) return false;

  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;

  if (hashedBuf.length !== suppliedBuf.length) return false;

  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "spineguardai-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: app.get("env") === "production",
      httpOnly: true,
      sameSite: "lax",
    },
  };

  if ((storage as any).sessionStore) {
    sessionSettings.store = (storage as any).sessionStore;
  }

  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);

        if (!user) {
          return done(null, false);
        }

        const isValid = await comparePasswords(password, user.password);
        if (!isValid) {
          return done(null, false);
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user, done) => {
    done(null, (user as SelectUser).id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(String(id));
      done(null, user || false);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/login", (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("local", (err: any, user: any) => {
      if (err) return next(err);

      if (!user) {
        return res.status(401).json({
          message: "Invalid username or password",
        });
      }

      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr);

        return res.status(200).json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req: Request, res: Response, next: NextFunction) => {
    req.logout((err) => {
      if (err) return next(err);

      req.session.destroy((destroyErr) => {
        if (destroyErr) return next(destroyErr);

        res.clearCookie("connect.sid");
        return res.sendStatus(200);
      });
    });
  });

  app.get("/api/user", (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    return res.json(req.user);
  });
}

export function ensureAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.isAuthenticated()) {
    return next();
  }

  return res.status(401).send("Unauthorized");
}