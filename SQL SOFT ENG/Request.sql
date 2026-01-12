use `Soft Eng 2`;

CREATE TABLE Request (
    RequestID INT AUTO_INCREMENT PRIMARY KEY,
    
    RequesterName VARCHAR(50) NOT NULL,
    RequestedTitle VARCHAR(255) NOT NULL,
    DateRequested DATE NOT NULL,

    Status ENUM(
        'Pending',
        'Approved',
        'Completed',
        'Denied',
        'Evaluating'
    ) NOT NULL DEFAULT 'Pending',

    Remarks TEXT NULL

);



