document.addEventListener("DOMContentLoaded", function () {

    var loginButton = document.getElementById("loginBtn");
    var loginForm = document.getElementById("loginForm");

    if (!loginForm || !loginButton) return;

    loginButton.addEventListener("click", function (event) {
        event.preventDefault();

        if (validateForm()) {
            // Submit the form so the server-side Login action runs
            loginForm.submit();
        }
    });

    function validateForm() {
        var user = document.getElementById("username").value;
        var pass = document.getElementById("password").value;

        if (user.trim() === "" || pass.trim() === "") {
            alert("Please fill in both Email and Password fields.");
            return false;
        }

        return true;
    }

    // Function to toggle edit mode (Mimicking Borrowed Books Edit style)
    document.getElementById('btnEditToggle').addEventListener('click', function () {
        const isEditing = this.innerText === "Save";
        const inputs = [
            document.getElementById('detailPaymentStatus'),
            document.getElementById('detailFineAmount'),
            document.getElementById('detailDatePaid')
        ];

        if (!isEditing) {
            // Switch to Edit Mode
            inputs.forEach(input => input.disabled = false);
            this.innerText = "Save";
            this.className = "btn btn-green"; // Change color to indicate save
        } else {
            // Submit the form
            const formData = {
                FineID: document.getElementById('detailFineID').value,
                PaymentStatus: document.getElementById('detailPaymentStatus').value,
                FineAmount: document.getElementById('detailFineAmount').value,
                totalFineAmount: document.getElementById('detailFineAmount').value, // Example sync
                DatePaid: document.getElementById('detailDatePaid').value || null
            };

            fetch('/Home/EditFine', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(formData)
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert("Fine updated successfully!");
                        location.reload(); // Refresh table
                    } else {
                        alert("Error: " + data.error);
                    }
                });
        }
    });

    // Function to open and populate the modal
    function openFineModal(data) {
        document.getElementById('detailFineID').value = data.fineID;
        document.getElementById('detailBorrowerName').value = data.borrowerName;
        document.getElementById('detailLoanID').value = data.loanID;
        document.getElementById('detailPaymentStatus').value = data.paymentStatus;
        document.getElementById('detailFineAmount').value = data.fineAmount;
        document.getElementById('detailDatePaid').value = data.datePaid === "-" ? "" : data.datePaid;

        document.getElementById('fineDetailsModal').style.display = 'block';
    }
});

