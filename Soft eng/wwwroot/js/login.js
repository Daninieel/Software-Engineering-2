document.addEventListener("DOMContentLoaded", function () {

    var loginButton = document.getElementById("loginBtn");


    loginButton.addEventListener("click", function (event) {
        if (!validateForm()) {
            event.preventDefault(); 
        }
    });

    function validateForm() {
        var user = document.getElementById("username").value;
        var pass = document.getElementById("password").value;

        if (user.trim() === "" || pass.trim() === "") {
            alert("Please fill in both User and Password fields.");
            return false;
        }

        
        console.log("Validation passed.");
        return true;
    }
});