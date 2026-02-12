USE `Soft Eng 2`;

CREATE TABLE ArchivedBooks (
    ArchiveID INT AUTO_INCREMENT PRIMARY KEY,
    BookID INT NOT NULL,
    BookTitle VARCHAR(255),
    Author VARCHAR(255),
    ISBN VARCHAR(20),
    Publisher VARCHAR(255),
    ShelfLocation VARCHAR(100),
    TotalCopies INT,
    DateArchived DATETIME DEFAULT CURRENT_TIMESTAMP,
    ArchiveReason VARCHAR(50)
);

