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
});