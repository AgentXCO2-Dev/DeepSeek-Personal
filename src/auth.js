import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { config } from './config.js';
import {
  findUserByEmail,
  findUserByGoogleId,
  createUser,
  createUserWithGoogle,
  findUserById,
  getDb
} from './db.js';

const router = express.Router();

// ============================
// JWT Helpers
// ============================

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn || '7d' }
  );
}

// ============================
// Google OAuth – ONLY if credentials are set
// ============================

if (config.googleClientId && config.googleClientSecret) {
  console.log('🔐 Google OAuth enabled');

  passport.use(new GoogleStrategy({
      clientID: config.googleClientId,
      clientSecret: config.googleClientSecret,
      callbackURL: config.googleCallbackUrl,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email = profile.emails?.[0]?.value;
        const displayName = profile.displayName || email;
        if (!email) {
          return done(new Error('No email from Google'), null);
        }
        let user = await findUserByGoogleId(googleId);
        if (!user) {
          user = await findUserByEmail(email);
          if (user) {
            const db = await getDb();
            await db.run('UPDATE users SET google_id = ? WHERE id = ?', googleId, user.id);
            user = await findUserById(user.id);
          } else {
            const newId = await createUserWithGoogle(googleId, email, displayName);
            user = await findUserById(newId);
          }
        }
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  ));

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    const user = await findUserById(id);
    done(null, user);
  });

} else {
  console.log('⚠️ Google OAuth disabled – set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable');
}

// ============================
// PAYWALL VERIFICATION (WITH DEBUGGING)
// ============================

router.post('/verify-password', (req, res) => {
  console.log('🔥🔥🔥 PAYWALL ROUTE HIT! 🔥🔥🔥');
  console.log('📦 Request body:', req.body);
  console.log('📦 Request headers:', {
    'content-type': req.headers['content-type'],
    'origin': req.headers['origin'],
  });
  
  const { password } = req.body;
  
  console.log('🔍 Received password:', password);
  console.log('🔑 Config passwords:', config.apiPasswords);
  console.log('🔑 Type of config.apiPasswords:', typeof config.apiPasswords);
  console.log('🔑 Is it an array?', Array.isArray(config.apiPasswords));
  console.log('🔑 Length:', config.apiPasswords?.length || 0);
  
  if (!password) {
    console.log('❌ No password provided');
    return res.status(400).json({ error: 'Password required' });
  }
  
  const isValid = config.apiPasswords.includes(password);
  console.log('✅ Is valid?', isValid);
  
  if (!isValid) {
    console.log('❌ Invalid password attempt:', password);
    return res.status(401).json({ error: 'Invalid password' });
  }
  
  console.log('✅ Paywall passed successfully!');
  res.json({ success: true });
});

// ============================
// REGISTER
// ============================

router.post('/register', async (req, res) => {
  console.log('📝 Register attempt:', req.body.email);
  const { email, password, displayName } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const existing = await findUserByEmail(email);
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }
  const hash = await bcrypt.hash(password, 10);
  const userId = await createUser(email, hash, displayName || email);
  const user = await findUserById(userId);
  const token = generateToken(user);
  console.log('✅ User registered:', email);
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name
    }
  });
});

// ============================
// LOGIN
// ============================

router.post('/login', async (req, res) => {
  console.log('🔐 Login attempt:', req.body.email);
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  const user = await findUserByEmail(email);
  if (!user) {
    console.log('❌ User not found:', email);
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  if (!user.password_hash) {
    console.log('❌ Account uses Google login:', email);
    return res.status(401).json({ error: 'Account uses Google login. Please sign in with Google.' });
  }
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    console.log('❌ Invalid password for:', email);
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = generateToken(user);
  const userData = {
    id: user.id,
    email: user.email,
    displayName: user.display_name
  };
  console.log('✅ User logged in:', email);
  res.json({ token, user: userData });
});

// ============================
// GOOGLE OAUTH ROUTES – ONLY IF ENABLED
// ============================

if (config.googleClientId && config.googleClientSecret) {
  router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

  router.get('/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/auth/google/failure' }),
    (req, res) => {
      const token = generateToken(req.user);
      const user = {
        id: req.user.id,
        email: req.user.email,
        displayName: req.user.display_name
      };
      const frontendUrl = process.env.FRONTEND_URL || 'https://AgentXCO2-Dev.github.io/DeepSeek-Personal';
      console.log('✅ Google login success:', user.email);
      res.redirect(`${frontendUrl}?token=${token}&user=${encodeURIComponent(JSON.stringify(user))}`);
    }
  );

  router.get('/google/failure', (req, res) => {
    console.log('❌ Google login failed');
    res.status(401).json({ error: 'Google authentication failed' });
  });
}

// ============================
// GET CURRENT USER (PROTECTED)
// ============================

router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await findUserById(decoded.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      id: user.id,
      email: user.email,
      displayName: user.display_name
    });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
