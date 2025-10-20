const net = require('net');

function scanPort(host, port, timeout=2000){
  return new Promise(resolve=>{
    const s = new net.Socket();
    let status = 'closed';
    s.setTimeout(timeout);
    s.on('connect', ()=>{ status='open'; s.destroy(); });
    s.on('timeout', ()=>{ status='closed'; s.destroy(); });
    s.on('error', ()=>{ status='closed'; });
    s.on('close', ()=>{ resolve({ port, status }); });
    s.connect(port, host);
  });
}

exports.run = async function(arg){
  if(!arg) return 'Gunakan: /portscan <ip_or_host>';
  const host = arg.trim();
  const common = [21,22,23,25,53,80,110,135,139,143,443,445,3389,8080];
  const results = [];
  for(const p of common){
    try{ const r = await scanPort(host, p); results.push(r); }catch(e){ results.push({ port:p, status:'error' }); }
  }
  return JSON.stringify(results, null, 2);
};
