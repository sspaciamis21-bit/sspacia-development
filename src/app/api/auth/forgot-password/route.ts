import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { username, email, newPassword } = body

    if (!username || !email || !newPassword) {
      return NextResponse.json(
        { error: 'Username, Email ID, and New Password are required' },
        { status: 400 }
      )
    }

    if (newPassword.trim().length < 6) {
      return NextResponse.json(
        { error: 'New password must be at least 6 characters long' },
        { status: 400 }
      )
    }

    const trimmedUsername = username.trim()
    const trimmedEmail = email.trim()

    // ─── Find user matching BOTH username (name) and email ────────
    const user = await prisma.user.findFirst({
      where: {
        name: trimmedUsername,
        email: trimmedEmail,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'No account found matching this Username and Email combination' },
        { status: 404 }
      )
    }

    // ─── Hash New Password and Update ─────────────────────────────
    const hashedPassword = await bcrypt.hash(newPassword.trim(), 10)

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    })

    return NextResponse.json({
      message: 'Password reset successfully! You can now log in with your new password.',
    })

  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json(
      { error: 'Failed to reset password. Please try again.' },
      { status: 500 }
    )
  }
}
