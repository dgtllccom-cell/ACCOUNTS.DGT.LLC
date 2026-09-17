import { ImapFlow } from 'imapflow';

const cfg = { email: 'dgtllc@dgt.llc', password: 'Chaman@9090' };

(async () => {
  try {
    const c = new ImapFlow({
      host: 'imap.titan.email',
      port: 993,
      secure: true,
      auth: cfg,
      logger: false,
      socketTimeout: 8000
    });

    console.log('Connecting...');
    await c.connect();
    console.log('✅ Connected');

    console.log('Opening Drafts...');
    const box = await c.mailboxOpen('Drafts');
    console.log('✅ Drafts open');
    console.log('   Messages:', box.exists);

    console.log('Searching...');
    const results = await c.search({ all: true });
    console.log('✅ Search result:', results?.length || 0);

    if (Array.isArray(results) && results.length > 0) {
      console.log('Fetching first message...');
      const msg = await c.fetchOne(results[0], { envelope: true });
      console.log('✅ Fetched');
      console.log('   Subject:', msg?.envelope?.subject);
    }

    await c.logout();
    console.log('✅ Done');
  } catch (err) {
    console.error('❌', err instanceof Error ? err.message : err);
  }
})();
