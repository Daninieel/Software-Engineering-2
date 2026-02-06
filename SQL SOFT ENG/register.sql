USE `Soft Eng 2`;

CREATE TABLE IF NOT EXISTS Register (
    UserID INT AUTO_INCREMENT PRIMARY KEY,
    FullName VARCHAR(100) NOT NULL,
    Email VARCHAR(100) NOT NULL UNIQUE,
    Password VARCHAR(255) NOT NULL,
    ConfirmPassword VARCHAR(255) NOT NULL,
    Role VARCHAR(50) NOT NULL DEFAULT 'Librarian',
    IsEmailVerified TINYINT(1) DEFAULT 0,
    VerificationToken VARCHAR(255) NULL,
    TokenExpiry DATETIME NULL,
    PasswordResetToken VARCHAR(255) NULL,
    PasswordResetExpiry DATETIME NULL,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (Email),
    INDEX idx_verification_token (VerificationToken),
    INDEX idx_password_reset_token (PasswordResetToken)
);

DELETE FROM Register WHERE Email = 'admin@sia';

INSERT INTO Register (FullName, Email, Password, ConfirmPassword, Role, IsEmailVerified, CreatedAt)
VALUES (
    'System Administrator',
    'admin@sia',
    '$2a$11$xK5P7zQJ9rE8mNvL2pQrXuYtZwAaBbCcDdEeFfGgHhIiJjKkLlMm',  
    '$2a$11$xK5P7zQJ9rE8mNvL2pQrXuYtZwAaBbCcDdEeFfGgHhIiJjKkLlMm', 
    'School Admin',
    1,
    NOW()
);

SELECT UserID, FullName, Email, Role, IsEmailVerified 
FROM Register 
WHERE Email = 'admin@sia';
