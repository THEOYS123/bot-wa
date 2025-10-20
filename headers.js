const axios = require('axios');

exports.run = async function(arg){
  if(!arg) return 'Gunakan: /headers <url>';
  let url = arg.trim(); if(!/^https?:\/\//i.test(url)) url = 'http://' + url;
  try{
    const r = await axios.head(url, { timeout: 10000, maxRedirects: 5 });
    return JSON.stringify(r.headers, null, 2);
  }catch(err){
    if(err.response) return JSON.stringify(err.response.headers || {}, null,2);
    return `Error fetching headers: ${err.message}`;
  }
};
