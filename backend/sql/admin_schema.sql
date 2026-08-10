-- Run this in MySQL Workbench (or `mysql -u root -p tata_vision < admin_schema.sql`)


USE tata_vision;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'User',
  status VARCHAR(20) DEFAULT 'Active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

