import crypto from "node:crypto";

const digest = (password, salt) => crypto.scryptSync(password, salt, 32).toString("hex");
export class LocalAuthProvider {
  constructor() { this.users = new Map(); this.sessions = new Map(); }
  register(email, password, role = "USER") {
    if (!email || !password || password.length < 12) throw new Error("PASSWORD_MINIMUM_12_CHARACTERS");
    if (this.users.has(email)) throw new Error("USER_ALREADY_EXISTS");
    const salt = crypto.randomBytes(16).toString("hex");
    this.users.set(email, { email, role, salt, passwordHash: digest(password, salt) });
    return { email, role };
  }
  login(email, password) {
    const user = this.users.get(email);
    if (!user || digest(password, user.salt) !== user.passwordHash) throw new Error("INVALID_CREDENTIALS");
    const token = crypto.randomBytes(32).toString("hex");
    this.sessions.set(token, user);
    return { token, user: { email: user.email, role: user.role } };
  }
  authenticate(token) { return this.sessions.get(token) || null; }
}
