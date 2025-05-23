const jwt = require('jsonwebtoken');

// Generate Access Token (15 minutes)
const generateAccessToken = (userId) => {
  return jwt.sign(
    { 
      userId, 
      type: 'access' 
    },
    process.env.JWT_ACCESS_SECRET,
    { 
      expiresIn: '15m',
      issuer: 'portfolio-api',
      audience: 'portfolio-admin'
    }
  );
};

// Generate Refresh Token (7 days)
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { 
      userId, 
      type: 'refresh' 
    },
    process.env.JWT_REFRESH_SECRET,
    { 
      expiresIn: '7d',
      issuer: 'portfolio-api',
      audience: 'portfolio-admin'
    }
  );
};

// Generate both tokens
const generateTokens = (userId) => {
  const accessToken = generateAccessToken(userId);
  const refreshToken = generateRefreshToken(userId);
  
  return {
    accessToken,
    refreshToken,
    expiresIn: 15 * 60 * 1000 // 15 minutes in milliseconds
  };
};

// Verify Access Token
const verifyAccessToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
      issuer: 'portfolio-api',
      audience: 'portfolio-admin'
    });
    
    if (decoded.type !== 'access') {
      throw new Error('Invalid token type');
    }
    
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired access token');
  }
};

// Verify Refresh Token
const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
      issuer: 'portfolio-api',
      audience: 'portfolio-admin'
    });
    
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken
};