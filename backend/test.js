const db = require('./database');

console.log('Testing database connection...');

db.getAllItems('products').then(products => {
  console.log('Products:', products);
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});