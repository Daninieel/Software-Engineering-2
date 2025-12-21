document.addEventListener("DOMContentLoaded", function () {

    var loginButton = document.getElementById("loginBtn");

    loginButton.addEventListener("click", function (event) {
        event.preventDefault();

        if (validateForm()) {
            window.location.href = "/Home/AddBooks";

        }
    });

    function validateForm() {
        var user = document.getElementById("username").value;
        var pass = document.getElementById("password").value;

        if (user.trim() === "" || pass.trim() === "") {
            alert("Please fill in both Email and Password fields.");
            return false;
        }

        console.log("Validation successful. Redirecting...");
        return true;
    }
});