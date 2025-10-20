const { exec } = require('child_process');

exports.run = async function(arg){
  if(!arg) return 'Gunakan: /nmap <target> (contoh: /nmap example.com)';
  const target = arg.trim().split(/\s+/)[0];
  return new Promise(resolve=>{
    // cek availability nmap
    exec('which nmap', (wErr, wOut)=>{
      if(wErr || !wOut.trim()) return resolve('⚠️ nmap tidak ditemukan di sistem. Install nmap untuk menggunakan fitur ini.');
      // jalankan nmap ringan (port 1-1024, service detection, no ping)
      const cmd = `nmap -Pn -sV --top-ports 100 ${target}`;
      exec(cmd, { maxBuffer: 1024*1024 }, (err, stdout, stderr)=>{
        if(err) return resolve(`Error menjalankan nmap: ${err.message}`);
        resolve(stdout || stderr || 'No output');
      });
    });
  });
};
