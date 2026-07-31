import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'
import { SignJWT } from 'jose'

// ✅ Use JWT_SECRET consistently
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const identifier = (body.username || body.email || '').trim()
    const { password } = body

    // ─── Validate Fields ──────────────────────────────────
    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      )
    }

    // ─── Find User by Username (name) OR Email ────────────
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { name: identifier },
          { email: identifier },
        ],
      },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
        assignedLocations: {
          include: { location: true },
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      )
    }

    // ─── Check if Active ──────────────────────────────────
    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Your account has been deactivated' },
        { status: 403 }
      )
    }

    // ─── Verify Password ──────────────────────────────────
    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      )
    }

    // ─── Get Permissions ──────────────────────────────────
    const permissions = user.role.permissions.map(
      (rp) => rp.permission.name
    )

    // ─── Generate JWT Token ───────────────────────────────
    const token = await new SignJWT({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name,
      permissions,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(JWT_SECRET)

    // ─── Return Response ──────────────────────────────────
    const response = NextResponse.json({
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.name,
        permissions,
        assignedLocations: user.assignedLocations.map((ul) => ({
          id: ul.location.id,
          name: ul.location.name,
        })),
      },
      token,
    })

    // ✅ Set token as HTTP-only cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    return response

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}