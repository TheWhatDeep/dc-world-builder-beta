/* Dev-only static file server for local preview. Not part of the app. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const PORT = process.env.PORT || 8765;
const MIME = {
  '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
  '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
  '.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2'
};
http.createServer((req,res)=>{
  let p = decodeURIComponent(req.url.split('?')[0]);
  if(p==='/') p='/index.html';
  const fp = path.join(root, p);
  if(!fp.startsWith(root)){ res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(fp,(err,data)=>{
    if(err){ res.writeHead(404); return res.end('not found'); }
    res.writeHead(200,{'Content-Type':MIME[path.extname(fp).toLowerCase()]||'application/octet-stream'});
    res.end(data);
  });
}).listen(PORT, ()=>console.log('serving '+root+' on http://localhost:'+PORT));
