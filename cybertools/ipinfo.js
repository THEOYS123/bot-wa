const axios = require('axios');

exports.run = async function(arg){
  if(!arg) return 'Gunakan: /ipinfo <ip_or_host>';
  const ip = arg.trim();
  try{
    const r = await axios.get(`http://ip-api.com/json/${encodeURIComponent(ip)}`, { timeout: 8000 });
    return JSON.stringify(r.data, null, 2);
  }catch(err){ return `Error fetch ipinfo: ${err.message}`; }
};
