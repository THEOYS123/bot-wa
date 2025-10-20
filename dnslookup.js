const dns = require('dns').promises;

exports.run = async function(arg){
  if(!arg) return 'Gunakan: /dnslookup <domain>';
  const domain = arg.trim();
  const out = {};
  try{
    out.A = await dns.resolve(domain, 'A').catch(()=>[]);
    out.MX = await dns.resolve(domain, 'MX').catch(()=>[]);
    out.NS = await dns.resolve(domain, 'NS').catch(()=>[]);
    out.TXT = await dns.resolve(domain, 'TXT').catch(()=>[]);
    out.CNAME = await dns.resolve(domain, 'CNAME').catch(()=>[]);
  }catch(err){ out.error = err.message; }
  return JSON.stringify(out, null, 2);
};
