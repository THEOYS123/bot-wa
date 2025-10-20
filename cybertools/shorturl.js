const axios = require('axios');

exports.run = async function(arg){
  if(!arg) return 'Gunakan: /shorturl <url>';
  const url = arg.trim();
  try{
    const r = await axios.get('http://tinyurl.com/api-create.php', { params: { url }, timeout: 8000 });
    return `Short URL: ${r.data}`;
  }catch(err){ return `Error create shorturl: ${err.message}`; }
};
