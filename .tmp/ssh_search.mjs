import { Client } from 'ssh2';

const conn = new Client();

conn.on('ready', () => {
  console.log('SSH :: terhubung ke 10.16.124.242');
  conn.exec(`find / -name "noc-manager2" -type d 2>/dev/null`, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', (code, signal) => {
      console.log('Hasil pencarian direktori:', out);
      if(out) {
        const dir = out.trim().split('\n')[0];
        console.log("Menjalankan query di:", dir);
        conn.exec(`cd ${dir} && npx prisma query "SELECT * FROM Ticket WHERE trackingId LIKE '%VLX-6JY-J948%'"`, (e2, s2) => {
           // We will just do a simpler search or just run a node script
           conn.end();
        });
      } else {
        conn.end();
      }
    }).on('data', (data) => {
      out += data;
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
})
.on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
  console.log('Keyboard-interactive prompt:', prompts);
  if (prompts.length > 0 && prompts[0].prompt.toLowerCase().includes('password')) {
    finish(['Hspnet2026']);
  } else {
    finish(['Hspnet2026']);
  }
})
.on('error', (err) => {
  console.log('SSH Error:', err.message);
})
.connect({
  host: '10.16.124.242',
  port: 22,
  username: 'nochspnet',
  password: 'Hspnet2026',
  tryKeyboard: true
});
