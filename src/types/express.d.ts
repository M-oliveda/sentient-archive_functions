/**
 * Express Type Extensions
 *
 * Extends Express Request type to include authenticated user
 * This file uses inline types to ensure proper global augmentation
 */

declare global {
    namespace Express {
        interface Request {
            user?: {
                uid: string;
                email: string;
                displayName: string | null;
                photoURL: string | null;
                role: "client" | "admin";
                isActive: boolean;
                tokenBalance: number;
            };
            uid?: string;
            file?: {
                buffer: Buffer;
                filename: string;
                mimeType: string;
                size: number;
            };
            rawBody?: Buffer;
        }
    }
}

export {};
