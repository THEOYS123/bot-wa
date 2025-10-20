const axios = require('axios');

exports.run = async function(arg){
  if(!arg) return 'Gunakan: /expandurl <shorturl>';
  const url = arg.trim();
  try{
    const r = await axios.head(url, { maxRedirects: 10, timeout: 10000, validateStatus: null });
    const final = r.request?.res?.responseUrl || r.headers.location || url;
    return `Final URL: ${final}`;
  }catch(err){ return `Error expandurl: ${err.message}`; }
};
