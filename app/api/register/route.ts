import { hash } from 'argon2';
import { z } from 'zod';
import dbConnect from '@/lib/db/mongodb';
import User from '@/lib/models/User';
import { apiError, apiSuccess } from '@/lib/api/response';

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80, 'Name is too long'),
  email: z.string().email('Invalid email address').transform((value) => value.trim().toLowerCase()),
  password: z.string().min(8, 'Password must be at least 8 characters').regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, 'Password must include uppercase, lowercase, and a number'),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, password } = registerSchema.parse(body);

    const connection = await dbConnect();
    if (!connection) {
      return apiError('Database unavailable', 503);
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return apiError('User with this email already exists', 409);
    }

    const hashedPassword = await hash(password);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: 'user',
      carbonPoints: 0,
      carbonSaved: 0,
    });

    return apiSuccess({ message: 'User registered successfully', userId: user._id.toString() }, {}, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message ?? 'Invalid request body', 400);
    }

    console.error('Register API error:', error);
    return apiError('An error occurred during registration', 500);
  }
}


