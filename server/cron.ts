import cron from 'node-cron';

export function startComplianceCronJobs() {
  console.log('[TASK-VAANI Cron Engine] Scheduled statutory compliance timers initialized.');

  // 1. Morning 10:30 AM Daily Statutory Reminder (Mon - Sat)
  cron.schedule('30 10 * * 1-6', () => {
    console.log('[Cron Alert] 10:30 AM IST: Triggering Daily Statutory Compliance Bell & Digest...');
    // Real notification dispatch logic here
  }, {
    timezone: 'Asia/Kolkata'
  });

  // 2. Weekly Client Summary Digest (Every Saturday 6:00 PM)
  cron.schedule('0 18 * * 6', () => {
    console.log('[Cron Digest] Saturday 6:00 PM IST: Preparing weekly client compliance summary emails...');
  }, {
    timezone: 'Asia/Kolkata'
  });
}
