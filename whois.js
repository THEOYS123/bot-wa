const { exec } = require('child_process');

exports.run = async function(arg){
  if(!arg) return 'Gunakan: /whois <domain>';
  const target = arg.trim().split(/\s+/)[0];
  return new Promise((resolve)=>{
    exec(`whois ${target}`, { maxBuffer: 1024*1024 }, (err, stdout, stderr)=>{
      if(err) return resolve(`Error menjalankan whois: ${err.message}`);
      resolve(stdout || stderr || 'No output');
    });
  });
};
