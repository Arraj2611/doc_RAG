import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { IUser } from '../models/User';

export interface UserPayload {
    id: string;
    email?: string;
    displayName?: string;
    username: string;
}

declare global {
    namespace Express {
        interface Request {
            user?: UserPayload;
        }
    }
}

export const authenticateToken = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        console.log('Auth middleware called for:', req.path);
        const authHeader = req.headers['authorization'];
        console.log('Auth header:', authHeader ? 'Present' : 'Missing');

        if (!authHeader) {
            console.log('No authorization header');
            return res.status(401).json({ error: 'No authorization header' });
        }

        const token = authHeader.startsWith('Bearer ')
            ? authHeader.substring(7)
            : authHeader;

        if (!token) {
            console.log('No token provided');
            return res.status(401).json({ error: 'No token provided' });
        }

        try {
            console.log('Verifying token...');
            const user = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as UserPayload;
            console.log('Token verified successfully for user:', user.username);
            req.user = user;
            next();
        } catch (error) {
            console.error('Token verification failed:', error);
            if (error instanceof jwt.JsonWebTokenError) {
                return res.status(403).json({ error: 'Invalid token' });
            } else if (error instanceof jwt.TokenExpiredError) {
                return res.status(403).json({ error: 'Token expired' });
            } else {
                return res.status(403).json({ error: 'Token verification failed' });
            }
        }
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(500).json({ error: 'Authentication failed' });
    }
}; 