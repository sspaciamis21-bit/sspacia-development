import { NextResponse } from 'next/server';
import { runDailyAgreementAlertEmails } from '@/lib/email-automation';

export const dynamic = 'force-dynamic';

/**
 * API route to dispatch daily agreement & lock-in alert emails
 * Can be called by a cron job at 9:00 AM daily, or manually triggered by Super Admin
 */
export async function POST(request: Request) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const receiver = body.receiver || 'cm@sspacia.com';

    const result = await runDailyAgreementAlertEmails(receiver);

    return NextResponse.json({
      success: true,
      message: `Daily 9:00 AM agreement & lock-in alert emails successfully dispatched (${result.sentCount} center email(s) sent)!`,
      result,
    });
  } catch (error: any) {
    console.error('Trigger daily agreement alert emails error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to dispatch daily agreement alert emails' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const result = await runDailyAgreementAlertEmails('cm@sspacia.com');
    return NextResponse.json({
      success: true,
      message: `Daily 9:00 AM agreement & lock-in alert emails successfully dispatched (${result.sentCount} center email(s) sent)!`,
      result,
    });
  } catch (error: any) {
    console.error('Trigger daily agreement alert emails GET error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to dispatch daily agreement alert emails' },
      { status: 500 }
    );
  }
}
