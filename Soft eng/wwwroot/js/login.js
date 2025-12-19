document.addEventListener("DOMContentLoaded", function () {

    var loginButton = document.getElementById("loginBtn");

    // Attach event listener to the button
    loginButton.addEventListener("click", function (event) {
        if (!validateForm()) {
            event.preventDefault(); // Stop the form from submitting if invalid
        }
    });

    function validateForm() {
        var user = document.getElementById("username").value;
        var pass = document.getElementById("password").value;

        if (user.trim() === "" || pass.trim() === "") {
            alert("Please fill in both User and Password fields.");
            return false;
        }

        // Logic to verify logic runs (remove in production)
        console.log("Validation passed.");
        return true;
    }
});