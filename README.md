This revised README.md uses clean Markdown formatting, including headers, horizontal rules, and distinct lists to ensure the documentation is organized and professional.

📚 Saint Isidore Academy Library Management System
The Saint Isidore Academy Library Management System is a robust web-based application designed to modernize library operations. Built with ASP.NET Core 9.0 and MySQL, it provides a secure environment for librarians and administrators to manage collections, track loans, and support students through AI integration.

**🛠️ System Architecture:**

Framework: ASP.NET Core 9.0 (MVC).

Database: MySQL Server for reliable data persistence.

Security: Password security implemented via BCrypt hashing.

**Core Libraries:**

DinkToPdf: High-quality PDF generation for library reports.

MySql.Data: High-performance database connectivity.

Pomelo.EntityFrameworkCore.MySql: For database mapping and queries.

**🚀 Key Features:**

**🔐 User Authentication & Security:**

Secure Access: Mandatory registration and login protocols to protect library data.

Role-Based Permissions: Distinct interfaces and capabilities for "Librarian" and "School Admin" roles.

Internal Admin Account: Built-in system administrator (admin@sia) for critical management tasks.

Password Recovery: Automated reset links delivered via Gmail SMTP integration.

**📊 Dashboard & Analytics:**

Real-time Statistics: Instant visibility into total books, borrowed items, returns, and overdue counts.

Condition Tracking: Specific counts for missing or damaged inventory.

Actionable Insights: Lists identifying the top 5 overdue borrowers and most recent loan activities.

**📖 Inventory Management (LogBook):**

Detailed Cataloging: Track ISBN, Author, Publisher, Edition, Year, and Shelf Location.

Dynamic Statuses: Real-time tracking of book states: Available, Borrowed, Missing, or Damaged.

Collection Updates: Streamlined forms to add new acquisitions or edit existing records.

**📑 Loan & Borrowing System:**

Automated Scheduling: Automatic calculation of a 4-day return window upon borrowing.

Status Synchronization: Automated inventory updates that mark books as "Borrowed" or "Available" based on loan status.

Overdue Management: Manual and automated toggles for overdue status that link directly to the fine system.

**💰 Fine Management:**

Automated Billing: Automatically generates an "Unpaid" fine of 5.00 for any overdue loan.

Financial Tracking: Capabilities to adjust fine amounts, update payment status, and record transaction dates.

**📥 Book Requests:**

Request Queue: Digital pipeline for users to request new titles.

Administrative Workflow: Tools for admins to approve requests, provide status updates, and add remarks.

**🤖 AI Library Assistant:**

Gemini AI Integration: An integrated chatbot acting as the "Saint Isidore Academy Library Assistant".

Smart Support: Provides users with instant help regarding library policies and general navigation.

**📋 Professional Reporting:**

Multi-Format Export: Generate detailed reports in PDF or CSV formats.

**Comprehensive Logs:**

Borrowed Books: Historical records of all loan transactions.

Fine Reports: Full summaries of payment histories and outstanding balances.

Requested Books: Consolidated list of community book requests.

**📋 Technical Setup Requirements:**

To ensure the system operates correctly, the following must be configured:

MySQL Database: The connection string must be properly set in appsettings.json under the DefaultConnection key.

Gemini API Key: A valid API key is required in the configuration to enable the AI Chatbot.

SMTP Credentials: Valid Gmail credentials must be provided to facilitate the password recovery system.

PDF Dependencies: The libwkhtmltox.dll file (included in the project) is required for the DinkToPdf library to function.
