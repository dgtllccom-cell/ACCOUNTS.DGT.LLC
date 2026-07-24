const { exec } = require('child_process');
exec('ssh -o BatchMode=yes -o ConnectTimeout=5 root@72.60.209.121 "pm2 status"', (error, stdout, stderr) => {
    console.log('stdout:', stdout);
    console.error('stderr:', stderr);
    if (error) {
        console.error('exec error:', error);
    }
});
