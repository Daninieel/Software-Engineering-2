CREATE TABLE Inventory (
    BookID INT AUTO_INCREMENT PRIMARY KEY,
    ISBN VARCHAR(50) NOT NULL,
    SourceType VARCHAR(50),               -- e.g., 'Donation', 'Purchased'
    BookTitle VARCHAR(255) NOT NULL,
    DateReceived DATE,
    Author VARCHAR(255),
    Pages INT,
    Edition VARCHAR(50),
    Publisher VARCHAR(255),
    Year DATE,                            -- Stored as DATE to match your form type
    Remarks TEXT,
    ShelfLocation VARCHAR(100),
    Availability VARCHAR(50),             -- e.g., 'Available', 'Unavailable'
    TotalCopies INT DEFAULT 1,
    BookStatus VARCHAR(50)                -- e.g., 'Good', 'Damaged'
);
