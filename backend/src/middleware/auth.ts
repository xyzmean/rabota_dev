import { Request, Response, NextFunction } from 'express';

// Simple authentication middleware for development
// In production, this would implement proper JWT authentication

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    permissions: any;
  };
}

/**
 * Simple authentication middleware
 * For now, it just adds a mock user to the request
 * TODO: Implement proper JWT authentication
 */
export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // For development, we'll use a mock user
  // In production, this would validate JWT tokens
  req.user = {
    id: 'mock-user-id',
    role: 'Управляющий',
    permissions: {
      manage_schedule: true,
      manage_employees: true,
      manage_shifts: true,
      manage_settings: true,
      view_statistics: true,
      approve_preferences: true,
      manage_roles: true,
      manage_validation_rules: true
    }
  };

  next();
};

/**
 * Role-based access control middleware
 */
export const requireRole = (requiredRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!requiredRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: requiredRoles,
        current: req.user.role
      });
    }

    next();
  };
};

/**
 * Permission-based access control middleware
 */
export const requirePermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!req.user.permissions[permission]) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: permission
      });
    }

    next();
  };
};