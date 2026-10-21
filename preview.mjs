// Development preview only. Serves the built HTML, no APIs or file uploads.
import http from 'node:http';
import {readFileSync} from 'node:fs';
const server=http.createServer((req,res)=>{
  if(req.method!=='GET'||!['/','/index.html'].includes(req.url)){res.writeHead(404);res.end();return;}
  const html=readFileSync(new URL('./dist/index.html',import.meta.url));
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Length':html.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(html);
});
server.listen(0,'127.0.0.1',()=>console.log(`Static preview: http://127.0.0.1:${server.address().port}`));
