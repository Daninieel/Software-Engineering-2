CREATE TABLE loan (
    LoanID INT PRIMARY KEY AUTO_INCREMENT,
    BookID INT NOT NULL,
    BorrowerID INT NOT NULL,
    DateBorrowed DATE NOT NULL,
    DateDue DATE NOT NULL,
    DateReturned DATE NULL,
    ReturnStatus VARCHAR(50) NOT NULL DEFAULT 'Not Returned',
    BookStatus VARCHAR(50) DEFAULT 'Borrowed',
    OverdueStatus BOOLEAN DEFAULT FALSE,
    
    -- Foreign Key Relationships
    CONSTRAINT fk_book FOREIGN KEY (BookID) REFERENCES logbook(BookID),
    CONSTRAINT fk_borrower FOREIGN KEY (BorrowerID) REFERENCES borrower(BorrowerID),
    
    -- Constraint: DateReturned must be >= DateBorrowed
    CONSTRAINT chk_date_returned CHECK (DateReturned IS NULL OR DateReturned >= DateBorrowed),
    
    -- Constraint: DateDue must be within 4 days of DateBorrowed
    CONSTRAINT chk_date_due CHECK (DateDue <= DateBorrowed + INTERVAL 4 DAY)
);
