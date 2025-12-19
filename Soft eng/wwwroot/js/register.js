document.addEventListener("DOMContentLoaded", function () {
    const registerForm = document.getElementById("registerForm");
    const passwordInput = document.getElementById("password");
    const confirmPasswordInput = document.getElementById("confirmPassword");

    if (registerForm) {
        registerForm.addEventListener("submit", function (event) {
            if (passwordInput.value !== confirmPasswordInput.value) {
                event.preventDefault(); 
                alert("Passwords do not match. Please try again.");

                confirmPasswordInput.style.border = "2px solid red";
                return;
            } else {
                confirmPasswordInput.style.border = "";
            }

            if (passwordInput.value.length < 6) {
                event.preventDefault();
                alert("Password must be at least 6 characters long.");
                return;
            }
        });
    }
});