Use `Soft Eng 2`;
CREATE TABLE IF NOT EXISTS Register (

    UserID INT AUTO_INCREMENT PRIMARY KEY,

    FullName VARCHAR(100) NOT NULL,

    Email VARCHAR(100) NOT NULL UNIQUE,

    Password VARCHAR(255) NOT NULL,

    ConfirmPassword VARCHAR(255) NOT NULL,

    Role VARCHAR(50) NOT NULL DEFAULT 'Librarian',

    IsLoggedIn TINYINT(1) DEFAULT 0,

    LastLoginAt DATETIME NULL,

    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);



INSERT IGNORE INTO Register (FullName, Email, Password, ConfirmPassword, Role) 

VALUES (

    'School Administrator', 

    'admin@sia', 

    '$2a$11$9z5XN.6V3mX0vDk3f.X0e.YhK8n.3z1Xn.G5f.G5f.G5f.G5f.G5f', 

    '$2a$11$9z5XN.6V3mX0vDk3f.X0e.YhK8n.3z1Xn.G5f.G5f.G5f.G5f.G5f',

    'School Admin'

);
