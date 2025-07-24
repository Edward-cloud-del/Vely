const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  console.log('Request for:', req.url);
  
  // Handle payments page
  if (req.url.startsWith('/payments.html') || req.url.startsWith('/payments')) {
    const filePath = path.join(__dirname, 'public', 'payments.html');
    
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Payments page not found');
        return;
      }
      
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  }
  // Handle success page
  else if (req.url.startsWith('/success.html') || req.url.startsWith('/success')) {
    const filePath = path.join(__dirname, 'success.html');
    
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Success page not found');
        return;
      }
      
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  }
  // Handle root
  else if (req.url === '/') {
    const filePath = path.join(__dirname, 'index.html');
    
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Index page not found');
        return;
      }
      
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  }
  else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Page not found: ' + req.url);
  }
});

 = 8080;
server.listen(PORT, () => {
  console.log(`Payments server running on http://localhost:${PORT}`);
}); 