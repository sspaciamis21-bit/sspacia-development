import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { verifyToken, signToken } from '@/lib/jwt'
import prisma from '@/lib/prisma'
import { cookies } from 'next/headers'

export async function PATCH(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || !payload.id) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const userId = Number(payload.id)
    const body = await req.json()
    const {
      name,
      email,
      password,
      phone,
      designation,
      companyName,
      companyCity,
      companyState,
      companyStreet,
      companyZip,
      contactNumber
    } = body

    // ─── Validate Email Uniqueness if changing ─────────────
    if (email !== undefined && email !== null) {
      const trimmedEmail = email.trim()
      if (trimmedEmail) {
        const existingEmailUser = await prisma.user.findFirst({
          where: {
            email: trimmedEmail,
            NOT: { id: userId }
          }
        })
        if (existingEmailUser) {
          return NextResponse.json({ error: 'Email address is already in use' }, { status: 400 })
        }
      }
    }

    // ─── Hash Password if provided ──────────────────────────
    let hashedPassword: string | undefined = undefined
    if (password && typeof password === 'string' && password.trim().length > 0) {
      if (password.trim().length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
      }
      hashedPassword = await bcrypt.hash(password.trim(), 10)
    }

    // ─── Update User in DB ──────────────────────────────────
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(email !== undefined && { email: email.trim() }),
        ...(hashedPassword && { password: hashedPassword }),
        ...(phone !== undefined && { phone }),
        ...(contactNumber !== undefined && { contactNumber }),
        ...(designation !== undefined && { designation }),
        ...(companyName !== undefined && { companyName }),
        ...(companyCity !== undefined && { companyCity }),
        ...(companyState !== undefined && { companyState }),
        ...(companyStreet !== undefined && { companyStreet }),
        ...(companyZip !== undefined && { companyZip }),
      },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true }
            }
          }
        }
      }
    })

    // ─── Re-issue JWT Token with fresh details ──────────────
    const permissions = updatedUser.role.permissions.map((rp) => rp.permission.name)
    const newToken = await signToken({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role.name,
      permissions,
    })

    const response = NextResponse.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role.name,
      }
    })

    response.cookies.set('auth-token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Profile update error:', error)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
