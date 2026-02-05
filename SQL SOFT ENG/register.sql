USE `Soft Eng 2`;

CREATE TABLE Register (
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

-- Only verify admin account (new users must verify their email)
UPDATE Register
SET IsEmailVerified = 1
WHERE Email = 'admin@sia';
