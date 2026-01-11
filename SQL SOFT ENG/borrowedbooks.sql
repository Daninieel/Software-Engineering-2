use `Soft Eng 2`;
CREATE TABLE BorrowedBooks (
    LoanID INT PRIMARY KEY AUTO_INCREMENT,
    BorrowerName VARCHAR(255) NOT NULL,
    BookTitle VARCHAR(255) NOT NULL,
    BorrowDate DATE NOT NULL,
    DueDate DATE NOT NULL,
    DateReturned DATE NULL,
    OverdueStatus VARCHAR(10) DEFAULT 'No',
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);