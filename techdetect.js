const axios = require('axios');

exports.run = async function(arg){
  if(!arg) return 'Gunakan: /techdetect <url>';
  let url = arg.trim(); if(!/^https?:\/\//i.test(url)) url = 'http://' + url;
  try{
    const r = await axios.get(url, { timeout: 12000 });
    const headers = r.headers;
    const body = r.data || '';
    const findings = [];
    if(/wp-content|wordpress/i.test(body)) findings.push('WordPress');
    if(/<meta name="generator" content="?([^"']+)"?/i.test(body)) findings.push('Meta generator present');
    if(/shopify/i.test(body)) findings.push('Shopify');
    if(/cdn-cgi/scripts/|cloudflare/i.test(body) || headers['server'] && /cloudflare/i.test(headers['server'])) findings.push('Cloudflare');
    if(/nginx/i.test(headers.server||'')) findings.push('nginx');
    if(/apache/i.test(headers.server||'')) findings.push('Apache');
    return JSON.stringify({ server: headers.server, findings, title: (body.match(/<title>([^<]*)<\/title>/i)||[])[1]||'' }, null, 2);
  }catch(err){ return `Error techdetect: ${err.message}`; }
};
