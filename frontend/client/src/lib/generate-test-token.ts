// This is a utility script to generate a JWT token for testing
// It should NOT be included in production code

import * as jose from 'jose';
import { setFastApiToken } from './api-client';

// JWT secret from backend (should match the one in api.py)
const JWT_SECRET = "4nZ#Gv!mTq@9xLp$2uYwRb7*AeJ6";
const JWT_ALGORITHM = "HS256";

export async function generateTestToken(userId: string = "test_user_123") {
  // Create a payload with the user ID
  const payload = {
    user_id: userId,
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // 24 hours expiration
    iat: Math.floor(Date.now() / 1000)
  };

  // Convert the secret to Uint8Array
  const secretKey = new TextEncoder().encode(JWT_SECRET);

  // Sign the token using jose
  const token = await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .sign(secretKey);

  // Store the token for API requests
  setFastApiToken(token);

  console.log("Generated test token:", token);
  console.log("Token payload:", payload);

  return token;
}

// Example usage:
// import { generateTestToken } from './generate-test-token';
// const token = generateTestToken('test_user_123');
