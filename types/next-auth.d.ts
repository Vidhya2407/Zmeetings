import type { DefaultSession } from 'next-auth';
import type { JWT as DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id: string;
      role: 'user' | 'creator' | 'admin';
      carbonPoints: number;
    };
  }

  interface User {
    id: string;
    role: 'user' | 'creator' | 'admin';
    carbonPoints: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id?: string;
    role?: 'user' | 'creator' | 'admin';
    carbonPoints?: number;
  }
}


