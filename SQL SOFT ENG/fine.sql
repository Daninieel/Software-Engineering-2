use `Soft Eng 2`;

CREATE TABLE Fine (
    FineID INT PRIMARY KEY AUTO_INCREMENT,
    LoanID INT NOT NULL,
    PaymentStatus VARCHAR(50) NOT NULL DEFAULT 'Unpaid',
    FineAmount DECIMAL(10, 2) NOT NULL DEFAULT 5.00,    
    totalFineAmount DECIMAL(10, 2) NOT NULL DEFAULT 5.00, 
    DatePaid DATE NULL,                                   
    
    CONSTRAINT fk_loan_fine FOREIGN KEY (LoanID) REFERENCES loan(LoanID) ON DELETE CASCADE
);