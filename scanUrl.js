const axios = require('axios');
const urlLib = require('url');

exports.run = async function(arg){
  if(!arg) return 'Gunakan: /scanurl <https://target>';
  let url = arg.trim();
  try{ if(!/^https?:\/\//i.test(url)) url = 'http://' + url; }
  catch(e){}
  const result = {};
  try{
    const res = await axios.get(url, { timeout: 12000, maxRedirects: 5 });
    result.status = res.status;
    result.headers = res.headers;
    result.server = res.headers.server || 'unknown';
    result.title = (res.data && (res.data.match(/<title>([^<]*)<\/title>/i)||[])[1]) || '';
  }catch(err){
    if(err.response){ result.status = err.response.status; result.headers = err.response.headers; }
    else result.error = err.message;
  }
  // basic ssl info via URL module
  try{
    const parsed = urlLib.parse(url);
    result.host = parsed.hostname;
  }catch(e){}
  return JSON.stringify(result, null, 2);
};
