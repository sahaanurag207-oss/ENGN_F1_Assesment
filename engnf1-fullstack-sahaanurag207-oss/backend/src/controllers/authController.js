import { userModel } from '../model/userModel.js';
import { validateRegister } from '../validators/schemas.js';
import { hashPassword, verifyPassword, signToken } from '../utils/authUtils.js';
import { Errors } from '../utils/AppError.js';

export const authController = {
  async register(req, res, next) {
    try {
      const { name, email, password } = validateRegister(req.body);
      const existing = await userModel.findByEmail(email);
      if (existing) {
        throw Errors.conflict('An account with this email already exists');
      }
      const passwordHash = await hashPassword(password);
      const user = await userModel.create({ name, email, passwordHash, role: 'USER' });
      res.status(201).json({ user });
    } catch (err) {
      next(err);
    }
  },

  async login(req, res, next) {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (!email || !password) {
        throw Errors.validation('Email and password are required');
      }

      const row = await userModel.findByEmail(email);
      if (!row || !(await verifyPassword(password, row.password_hash))) {
        throw Errors.unauthenticated('Invalid email or password');
      }

      const user = userModel.toPublic(row);
      const token = signToken(user);
      res.status(200).json({ token, user });
    } catch (err) {
      next(err);
    }
  },

  async me(req, res, next) {
    try {
      const user = await userModel.findById(req.user.id);
      if (!user) throw Errors.unauthenticated('User no longer exists');
      res.status(200).json({ user });
    } catch (err) {
      next(err);
    }
  }
};
