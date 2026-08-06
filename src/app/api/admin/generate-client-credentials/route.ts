import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

/**
 * POST: Generate User accounts for all Client Master entries.
 * 
 * Username = companyName
 * Password = FIRSTWORD@1234 (e.g. "VITESSE AGRO LIMITED" → "VITESSE@1234")
 * Role = USER (id: 4)
 * 
 * Returns the plain-text credentials list so admin can share with clients.
 * Skips entries where a User with the same companyName already exists.
 */
export async function POST(request: Request) {
  try {
    // Only allow admins
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (token) {
      const payload = await verifyToken(token);
      const role = (payload?.role as string || '').toUpperCase();
      if (role !== 'ADMIN' && role !== 'SUPER_ADMIN' && role !== 'SUPER-ADMIN') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get USER role id
    const userRole = await prisma.role.findFirst({
      where: { name: { in: ['USER', 'User'] } },
    });

    if (!userRole) {
      return NextResponse.json({ error: 'USER role not found in database' }, { status: 400 });
    }

    // Fetch all Client Master entries with contact persons
    const clientMasterEntries = await (prisma as any).clientMaster.findMany({
      include: {
        contactPersons: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { srNo: 'asc' },
    });

    if (clientMasterEntries.length === 0) {
      return NextResponse.json({ error: 'No Client Master entries found' }, { status: 400 });
    }

    const results: {
      srNo: number;
      companyName: string;
      username: string;
      password: string;
      email: string;
      status: 'CREATED' | 'SKIPPED' | 'ERROR';
      reason?: string;
    }[] = [];

    for (const cm of clientMasterEntries) {
      const companyName = (cm.companyName || '').trim();
      if (!companyName) {
        results.push({
          srNo: cm.srNo,
          companyName: '(empty)',
          username: '',
          password: '',
          email: '',
          status: 'SKIPPED',
          reason: 'No company name',
        });
        continue;
      }

      // Generate username = companyName (as-is)
      const username = companyName;

      // Generate password = FIRSTWORD@1234
      const firstWord = companyName.split(/\s+/)[0].toUpperCase();
      const plainPassword = `${firstWord}@1234`;

      // Get email from first contact person, or generate a placeholder
      const contactEmail = cm.contactPersons?.[0]?.email?.trim() || null;
      const email = contactEmail || `${companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}@client.sspacia.com`;

      // Check if user with this name already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { name: username },
            { email: email },
          ],
        },
      });

      if (existingUser) {
        results.push({
          srNo: cm.srNo,
          companyName,
          username,
          password: plainPassword,
          email,
          status: 'SKIPPED',
          reason: `User already exists (id: ${existingUser.id}, name: ${existingUser.name})`,
        });
        continue;
      }

      try {
        // Hash password for storage
        const hashedPassword = await bcrypt.hash(plainPassword, 12);

        // Create User entry
        await prisma.user.create({
          data: {
            name: username,
            email: email,
            password: hashedPassword,
            companyName: companyName,
            phone: cm.contactPersons?.[0]?.mobileNo || null,
            isActive: true,
            roleId: userRole.id,
          },
        });

        results.push({
          srNo: cm.srNo,
          companyName,
          username,
          password: plainPassword,
          email,
          status: 'CREATED',
        });
      } catch (err: any) {
        results.push({
          srNo: cm.srNo,
          companyName,
          username,
          password: plainPassword,
          email,
          status: 'ERROR',
          reason: err.message || 'Unknown error',
        });
      }
    }

    const created = results.filter(r => r.status === 'CREATED').length;
    const skipped = results.filter(r => r.status === 'SKIPPED').length;
    const errors = results.filter(r => r.status === 'ERROR').length;

    return NextResponse.json({
      success: true,
      summary: { total: results.length, created, skipped, errors },
      credentials: results,
    });
  } catch (error) {
    console.error('Generate client credentials error:', error);
    return NextResponse.json({ error: 'Failed to generate credentials' }, { status: 500 });
  }
}
